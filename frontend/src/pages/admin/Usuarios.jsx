import { useState, useEffect } from 'react'
import { Plus, X, RefreshCw, Pencil, KeyRound, UserCheck, UserX, Users, Search, Trash2 } from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { formatGradoSeccion } from '../../lib/nivelAcademico'

const ROLES = [
  { v: 'i-auxiliar', label: 'Auxiliar Inicial' },
  { v: 'p-auxiliar', label: 'Auxiliar Primaria' },
  { v: 's-auxiliar', label: 'Auxiliar Secundaria' },
  { v: 'tutor',      label: 'Tutor' },
  { v: 'directivo',  label: 'Directivo' },
  { v: 'admin',      label: 'Administrador' },
]

import { GRADOS_POR_NIVEL, getSecciones, formatGrado, resolveAulaInicial } from '../../lib/nivelAcademico'

const NIVELES = [
  { v: 'inicial',    label: 'Inicial' },
  { v: 'primaria',   label: 'Primaria' },
  { v: 'secundaria', label: 'Secundaria' },
]

const NIVELES_DIRECTIVO = [
  { v: 'inicial',    label: 'Inicial (Directora)' },
  { v: 'primaria',   label: 'Primaria (Subdirector)' },
  { v: 'secundaria', label: 'Secundaria (Subdirector)' },
  { v: 'formacion',  label: 'Form. General (Subdirector)' },
  { v: 'todos',      label: 'Director del CEAUNE' },
]

const ROL_BADGE = {
  'i-auxiliar': 'badge-gris',
  'p-auxiliar': 'badge-gris',
  's-auxiliar': 'badge-gris',
  'tutor':      'badge-amarillo',
  'directivo':  'badge-azul',
  'admin':      'badge-rojo',
}

const FORM_INICIAL = {
  dni: '', nombre: '', apellido: '', email: '', password: '',
  rol: 'tutor', nivel: '', grado: '', seccion: '', telefono: '',
}

const FORM_EDITAR_INICIAL = {
  dni: '', nombre: '', apellido: '', email: '', telefono: '',
  rol: 'tutor', nivel: '', grado: '', seccion: '', activo: true,
  es_apoderado: false,
}

export default function Usuarios() {
  const [lista, setLista]           = useState([])
  const [total, setTotal]           = useState(0)
  const [cargando, setCargando]     = useState(true)

  // Modal nuevo
  const [modalNuevo, setModalNuevo] = useState(false)
  const [form, setForm]             = useState(FORM_INICIAL)
  const [creando, setCreando]       = useState(false)

  // Modal editar
  const [modalEditar, setModalEditar]   = useState(false)
  const [usuarioEdit, setUsuarioEdit]   = useState(null)
  const [formEditar, setFormEditar]     = useState(FORM_EDITAR_INICIAL)
  const [guardando, setGuardando]       = useState(false)

  // Modal contraseña
  const [modalPass, setModalPass]       = useState(false)
  const [usuarioPass, setUsuarioPass]   = useState(null)
  const [nuevaPass, setNuevaPass]       = useState('')
  const [cambiandoPass, setCambiandoPass] = useState(false)

  // Confirmación de desactivar/activar
  const [confirmId, setConfirmId]       = useState(null)
  const [toggling, setToggling]         = useState(false)

  // Gestión de hijos para personal con es_apoderado
  const [hijosStaff, setHijosStaff]           = useState([])
  const [buscarHijoModal, setBuscarHijoModal]  = useState(false)
  const [busquedaHijo, setBusquedaHijo]        = useState('')
  const [todosEstudiantes, setTodosEstudiantes] = useState([])
  const [cargandoEstudiantes, setCargandoEstudiantes] = useState(false)
  const [operandoHijo, setOperandoHijo]        = useState(false)

  const cargar = async () => {
    setCargando(true)
    try {
      const { data } = await api.get('/admin/usuarios')
      const all   = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
      const items = all.filter(u => u.rol !== 'apoderado')
      setLista(items)
      setTotal(items.length)
    } catch {
      toast.error('Error al cargar usuarios')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  // Carga estudiantes una sola vez al abrir el modal de búsqueda
  useEffect(() => {
    if (!buscarHijoModal) return
    setCargandoEstudiantes(true)
    const yaVinculados = hijosStaff.map(h => h.id)
    api.get('/estudiantes/', { params: { activo: true } })
      .then(({ data }) => {
        const lista = Array.isArray(data) ? data : []
        setTodosEstudiantes(lista.filter(e => !yaVinculados.includes(e.id)))
      })
      .catch(() => {})
      .finally(() => setCargandoEstudiantes(false))
  }, [buscarHijoModal]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── helpers ── */
  const setField       = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))
  const setFieldEditar = (field) => (e) => setFormEditar(f => ({ ...f, [field]: e.target.value }))

  const esAuxiliarForm  = ['i-auxiliar', 'p-auxiliar', 's-auxiliar'].includes(form.rol)
  const esTutorForm     = form.rol === 'tutor'
  const esDirectivoForm = form.rol === 'directivo'
  const esAuxiliarEdit  = ['i-auxiliar', 'p-auxiliar', 's-auxiliar'].includes(formEditar.rol)
  const esTutorEdit     = formEditar.rol === 'tutor'
  const esDirectivoEdit = formEditar.rol === 'directivo'

  const abrirEditar = (u) => {
    setUsuarioEdit(u)
    setFormEditar({
      dni:          u.dni      || '',
      nombre:       u.nombre   || '',
      apellido:     u.apellido || '',
      email:        u.email    || '',
      telefono:     u.telefono || '',
      rol:          u.rol      || 'tutor',
      nivel:        u.nivel    || u.aula?.nivel || '',
      grado:        u.aula?.grado   || '',
      seccion:      u.aula?.seccion || '',
      activo:       u.activo,
      es_apoderado: u.es_apoderado || false,
    })
    setHijosStaff(u.hijos || [])
    setModalEditar(true)
  }

  const abrirPassword = (u) => {
    setUsuarioPass(u)
    setNuevaPass('')
    setModalPass(true)
  }

  /* ── Crear ── */
  const handleCrear = async (e) => {
    e.preventDefault()
    const payload = {
      dni:      `CE${form.dni.trim()}`,
      nombre:   form.nombre.trim(),
      apellido: form.apellido.trim(),
      email:    form.email.trim(),
      password: form.password,
      rol:      form.rol,
      telefono: form.telefono.trim() || null,
    }
    if ((esAuxiliarForm || esDirectivoForm) && form.nivel) payload.nivel = form.nivel
    if (esTutorForm) {
      if (form.nivel)   payload.nivel_tutor = form.nivel
      if (form.grado)   payload.grado       = form.grado
      if (form.seccion) payload.seccion     = form.seccion
    }
    setCreando(true)
    try {
      await api.post('/admin/usuarios', payload)
      toast.success('Usuario creado')
      setModalNuevo(false)
      setForm(FORM_INICIAL)
      cargar()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al crear usuario')
    } finally {
      setCreando(false)
    }
  }

  /* ── Editar ── */
  const handleEditar = async (e) => {
    e.preventDefault()
    const payload = {
      nombre:       formEditar.nombre.trim(),
      apellido:     formEditar.apellido.trim(),
      email:        formEditar.email.trim(),
      telefono:     formEditar.telefono.trim() || null,
      rol:          formEditar.rol,
      activo:       formEditar.activo,
      es_apoderado: formEditar.es_apoderado,
    }
    if ((esAuxiliarEdit || esDirectivoEdit) && formEditar.nivel) payload.nivel = formEditar.nivel
    if (esTutorEdit) {
      if (formEditar.nivel)   payload.nivel_tutor = formEditar.nivel
      if (formEditar.grado)   payload.grado       = formEditar.grado
      if (formEditar.seccion) payload.seccion     = formEditar.seccion
    }
    setGuardando(true)
    try {
      await api.put(`/admin/usuarios/${usuarioEdit.id}`, payload)
      toast.success('Usuario actualizado')
      setModalEditar(false)
      cargar()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al actualizar')
    } finally {
      setGuardando(false)
    }
  }

  /* ── Cambiar contraseña ── */
  const handlePassword = async (e) => {
    e.preventDefault()
    if (nuevaPass.length < 6) return toast.error('Mínimo 6 caracteres')
    setCambiandoPass(true)
    try {
      await api.put(`/admin/usuarios/${usuarioPass.id}/password`, { nueva_password: nuevaPass })
      toast.success('Contraseña actualizada')
      setModalPass(false)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cambiar contraseña')
    } finally {
      setCambiandoPass(false)
    }
  }

  /* ── Activar / Desactivar ── */
  const handleToggleActivo = async (u) => {
    setToggling(true)
    try {
      if (u.activo) {
        await api.delete(`/admin/usuarios/${u.id}`)
        toast.success(`${u.nombre} desactivado`)
      } else {
        await api.put(`/admin/usuarios/${u.id}`, { activo: true })
        toast.success(`${u.nombre} reactivado`)
      }
      setConfirmId(null)
      cargar()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cambiar estado')
    } finally {
      setToggling(false)
    }
  }

  /* ── Toggle es_apoderado con auto-guardado ── */
  const toggleEsApoderado = async () => {
    const nuevoValor = !formEditar.es_apoderado
    setFormEditar(f => ({ ...f, es_apoderado: nuevoValor }))
    if (!usuarioEdit) return
    try {
      await api.put(`/admin/usuarios/${usuarioEdit.id}`, { es_apoderado: nuevoValor })
      setUsuarioEdit(prev => ({ ...prev, es_apoderado: nuevoValor }))
    } catch {
      // Revertir si falla
      setFormEditar(f => ({ ...f, es_apoderado: !nuevoValor }))
      toast.error('Error al actualizar')
    }
  }

  /* ── Filtrar estudiantes en el cliente ── */
  const estudiantesFiltrados = (() => {
    const q = busquedaHijo.trim().toLowerCase()
    if (!q) return todosEstudiantes.slice(0, 30)
    return todosEstudiantes.filter(e =>
      e.nombre.toLowerCase().includes(q) ||
      e.apellido.toLowerCase().includes(q) ||
      (e.dni || '').includes(q)
    ).slice(0, 30)
  })()

  /* ── Vincular hijo ── */
  const vincularHijo = async (estudiante) => {
    if (!usuarioEdit) return
    setOperandoHijo(true)
    try {
      await api.post(`/admin/apoderados/${usuarioEdit.id}/hijos/${estudiante.id}`)
      setHijosStaff(prev => [...prev, {
        id: estudiante.id,
        nombre: estudiante.nombre,
        apellido: estudiante.apellido,
        dni: estudiante.dni,
        nivel: estudiante.nivel,
        grado: estudiante.grado,
        seccion: estudiante.seccion,
      }])
      setTodosEstudiantes(prev => prev.filter(e => e.id !== estudiante.id))
      toast.success(`${estudiante.nombre} vinculado`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al vincular')
    } finally {
      setOperandoHijo(false)
    }
  }

  /* ── Desvincular hijo ── */
  const desvincularHijo = async (hijo) => {
    if (!usuarioEdit) return
    setOperandoHijo(true)
    try {
      await api.delete(`/admin/apoderados/${usuarioEdit.id}/hijos/${hijo.id}`)
      setHijosStaff(prev => prev.filter(h => h.id !== hijo.id))
      toast.success(`${hijo.nombre} desvinculado`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al desvincular')
    } finally {
      setOperandoHijo(false)
    }
  }

  const cerrarBuscarHijo = () => {
    setBuscarHijoModal(false)
    setBusquedaHijo('')
    setTodosEstudiantes([])
  }

  /* ── Render ── */
  return (
    <div className="space-y-5">

      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-marino">Gestión de Usuarios</h1>
          {!cargando && (
            <p className="text-xs text-gray-400 mt-0.5">{total} usuario{total !== 1 ? 's' : ''} en total</p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={cargar} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14} /> Actualizar
          </button>
          <button onClick={() => setModalNuevo(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} /> Nuevo usuario
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-gray-100">
              {['Nombre', 'DNI', 'Email', 'Rol', 'Estado', 'Acciones'].map((h) => (
                <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={6} className="text-center text-gray-400 py-8">
                  <span className="inline-flex items-center gap-2">
                    <span className="animate-spin w-4 h-4 border-2 border-dorado border-t-transparent rounded-full" />
                    Cargando...
                  </span>
                </td>
              </tr>
            ) : lista.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-gray-400 py-8">Sin usuarios registrados</td>
              </tr>
            ) : (
              lista.map((u) => (
                <tr key={u.id} className={`border-b border-gray-50 transition-colors ${u.activo ? 'hover:bg-gray-50' : 'bg-gray-50/60 opacity-70'}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-800">
                        {u.nombre} {u.apellido}
                        {u.aula && (
                          <span className="ml-2 text-xs text-gray-400">· {formatGradoSeccion(u.aula.nivel, u.aula.grado, u.aula.seccion)}</span>
                        )}
                      </p>
                      {u.es_apoderado && (
                        <span title="También es apoderado" className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-dorado/15 text-dorado">
                          <Users size={9} /> APO
                        </span>
                      )}
                    </div>
                    {u.telefono && (
                      <p className="text-xs text-gray-400 mt-0.5">📱 {u.telefono}</p>
                    )}
                    {!u.telefono && u.rol !== 'admin' && (
                      <p className="text-xs text-amber-400 mt-0.5">Sin WhatsApp</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-marino/8 text-marino px-2 py-0.5 rounded-lg font-semibold tracking-wider">
                      {u.dni}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[160px]">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={ROL_BADGE[u.rol] || 'badge-gris'}>
                      {ROLES.find((r) => r.v === u.rol)?.label || u.rol}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={u.activo ? 'badge-verde' : 'badge-rojo'}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {confirmId === u.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {u.activo ? '¿Desactivar?' : '¿Reactivar?'}
                        </span>
                        <button
                          onClick={() => handleToggleActivo(u)}
                          disabled={toggling}
                          className="text-xs px-2 py-0.5 rounded bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                        >
                          {toggling ? '...' : 'Sí'}
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600 hover:bg-gray-300"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => abrirEditar(u)}
                          title="Editar usuario"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-marino hover:bg-blue-50 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => abrirPassword(u)}
                          title="Cambiar contraseña"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        >
                          <KeyRound size={15} />
                        </button>
                        <button
                          onClick={() => setConfirmId(u.id)}
                          title={u.activo ? 'Desactivar usuario' : 'Reactivar usuario'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            u.activo
                              ? 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                              : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                          }`}
                        >
                          {u.activo ? <UserX size={15} /> : <UserCheck size={15} />}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Modal: Nuevo Usuario ── */}
      {modalNuevo && (
        <ModalBase titulo="Nuevo Usuario" onClose={() => { setModalNuevo(false); setForm(FORM_INICIAL) }}>
          <form onSubmit={handleCrear} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Nombre">
                <input className="input" value={form.nombre} onChange={setField('nombre')} placeholder="María" required />
              </Campo>
              <Campo label="Apellido">
                <input className="input" value={form.apellido} onChange={setField('apellido')} placeholder="López" required />
              </Campo>
            </div>
            <Campo label="Código institucional">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-marino text-sm select-none pointer-events-none tracking-wider">
                  CE
                </span>
                <input
                  className="input pl-9"
                  value={form.dni}
                  onChange={e => setForm(f => ({ ...f, dni: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                  placeholder="12345678"
                  inputMode="numeric"
                  required
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">DNI del trabajador — el sistema agrega CE automáticamente</p>
            </Campo>
            <Campo label="Email">
              <input type="email" className="input" value={form.email} onChange={setField('email')} placeholder="correo@ceaune.edu.pe" required />
            </Campo>
            <Campo label="Contraseña">
              <input type="password" className="input" value={form.password} onChange={setField('password')} placeholder="••••••••" required />
            </Campo>
            <Campo label="Rol">
              <select className="input" value={form.rol} onChange={setField('rol')}>
                {ROLES.map(({ v, label }) => <option key={v} value={v}>{label}</option>)}
              </select>
            </Campo>
            {(esAuxiliarForm || esTutorForm || esDirectivoForm) && (
              <Campo label="WhatsApp (opcional)">
                <input
                  className="input"
                  value={form.telefono}
                  onChange={setField('telefono')}
                  placeholder="9XXXXXXXX"
                  maxLength={15}
                  inputMode="tel"
                />
              </Campo>
            )}
            {(esAuxiliarForm || esTutorForm || esDirectivoForm) && (
              <Campo label={esDirectivoForm ? 'Cargo / Nivel' : 'Nivel'}>
                <select className="input" value={form.nivel}
                  onChange={(e) => setForm(f => ({ ...f, nivel: e.target.value, grado: '' }))} required>
                  <option value="">Seleccionar nivel...</option>
                  {(esDirectivoForm ? NIVELES_DIRECTIVO : NIVELES).map(({ v, label }) => <option key={v} value={v}>{label}</option>)}
                </select>
              </Campo>
            )}
            {esTutorForm && (
              <div className="grid grid-cols-2 gap-3">
                <Campo label={form.nivel === 'inicial' ? 'Edad' : 'Grado'}>
                  <select className="input" value={form.grado} onChange={e => { setField('grado')(e); setField('seccion')({ target: { value: '' } }) }} disabled={!form.nivel}>
                    <option value="">Seleccionar...</option>
                    {(GRADOS_POR_NIVEL[form.nivel] || []).map(g => <option key={g} value={g}>{formatGrado(form.nivel, g)}</option>)}
                  </select>
                </Campo>
                <Campo label={form.nivel === 'inicial' ? 'Aula' : 'Sección'}>
                  <select className="input" value={form.seccion} onChange={setField('seccion')} disabled={!form.grado}>
                    <option value="">Seleccionar...</option>
                    {getSecciones(form.nivel, form.grado).map(s => <option key={s} value={s}>{form.nivel === 'inicial' ? resolveAulaInicial(form.grado, s) : s}</option>)}
                  </select>
                </Campo>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setModalNuevo(false); setForm(FORM_INICIAL) }} className="btn-secondary flex-1">Cancelar</button>
              <button type="submit" disabled={creando} className="btn-primary flex-1">
                {creando ? 'Creando...' : 'Crear usuario'}
              </button>
            </div>
          </form>
        </ModalBase>
      )}

      {/* ── Modal: Editar Usuario ── */}
      {modalEditar && usuarioEdit && (
        <ModalBase titulo={`Editar · ${usuarioEdit.nombre} ${usuarioEdit.apellido}`} onClose={() => setModalEditar(false)}>
          <form onSubmit={handleEditar} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Nombre">
                <input className="input" value={formEditar.nombre} onChange={setFieldEditar('nombre')} required />
              </Campo>
              <Campo label="Apellido">
                <input className="input" value={formEditar.apellido} onChange={setFieldEditar('apellido')} required />
              </Campo>
            </div>
            <Campo label="Código institucional">
              <input
                className="input bg-gray-50 text-gray-500 cursor-not-allowed font-mono tracking-wider"
                value={formEditar.dni}
                readOnly
              />
              <p className="text-[11px] text-gray-400 mt-1">El código no se puede modificar</p>
            </Campo>
            <Campo label="Email">
              <input type="email" className="input" value={formEditar.email} onChange={setFieldEditar('email')} required />
            </Campo>
            <Campo label="Rol">
              <select className="input" value={formEditar.rol}
                onChange={(e) => setFormEditar(f => ({ ...f, rol: e.target.value, nivel: '', grado: '', seccion: '' }))}>
                {ROLES.map(({ v, label }) => <option key={v} value={v}>{label}</option>)}
              </select>
            </Campo>
            {formEditar.rol !== 'admin' && (
              <Campo label="WhatsApp (opcional)">
                <input
                  className="input"
                  value={formEditar.telefono}
                  onChange={setFieldEditar('telefono')}
                  placeholder="9XXXXXXXX"
                  maxLength={15}
                  inputMode="tel"
                />
              </Campo>
            )}
            {(esAuxiliarEdit || esTutorEdit || esDirectivoEdit) && (
              <Campo label={esDirectivoEdit ? 'Cargo / Nivel' : 'Nivel'}>
                <select className="input" value={formEditar.nivel}
                  onChange={(e) => setFormEditar(f => ({ ...f, nivel: e.target.value, grado: '' }))} required>
                  <option value="">Seleccionar nivel...</option>
                  {(esDirectivoEdit ? NIVELES_DIRECTIVO : NIVELES).map(({ v, label }) => <option key={v} value={v}>{label}</option>)}
                </select>
              </Campo>
            )}
            {esTutorEdit && (
              <div className="grid grid-cols-2 gap-3">
                <Campo label={formEditar.nivel === 'inicial' ? 'Edad' : 'Grado'}>
                  <select className="input" value={formEditar.grado} onChange={e => { setFieldEditar('grado')(e); setFieldEditar('seccion')({ target: { value: '' } }) }} disabled={!formEditar.nivel}>
                    <option value="">Seleccionar...</option>
                    {(GRADOS_POR_NIVEL[formEditar.nivel] || []).map(g => <option key={g} value={g}>{formatGrado(formEditar.nivel, g)}</option>)}
                  </select>
                </Campo>
                <Campo label={formEditar.nivel === 'inicial' ? 'Aula' : 'Sección'}>
                  <select className="input" value={formEditar.seccion} onChange={setFieldEditar('seccion')} disabled={!formEditar.grado}>
                    <option value="">Seleccionar...</option>
                    {getSecciones(formEditar.nivel, formEditar.grado).map(s => <option key={s} value={s}>{formEditar.nivel === 'inicial' ? resolveAulaInicial(formEditar.grado, s) : s}</option>)}
                  </select>
                </Campo>
              </div>
            )}

            {/* Estado */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-sm font-medium text-gray-700">Estado de la cuenta</span>
              <button
                type="button"
                onClick={() => setFormEditar(f => ({ ...f, activo: !f.activo }))}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  formEditar.activo
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-red-100 text-red-600 hover:bg-red-200'
                }`}
              >
                {formEditar.activo ? <UserCheck size={14} /> : <UserX size={14} />}
                {formEditar.activo ? 'Activo' : 'Inactivo'}
              </button>
            </div>

            {/* Toggle también es apoderado */}
            {formEditar.rol !== 'admin' && (
              <div className="border border-dorado/30 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={toggleEsApoderado}
                  className={`w-full flex items-center justify-between p-3 transition-colors ${
                    formEditar.es_apoderado ? 'bg-dorado/10' : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Users size={15} className={formEditar.es_apoderado ? 'text-dorado' : 'text-gray-400'} />
                    <span className={`text-sm font-medium ${formEditar.es_apoderado ? 'text-dorado' : 'text-gray-600'}`}>
                      También es apoderado
                    </span>
                  </div>
                  {/* Toggle visual */}
                  <div className={`w-10 h-5 rounded-full transition-colors relative ${formEditar.es_apoderado ? 'bg-dorado' : 'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${formEditar.es_apoderado ? 'left-5' : 'left-0.5'}`} />
                  </div>
                </button>

                {/* Sección de hijos — visible cuando es_apoderado activo */}
                {formEditar.es_apoderado && (
                  <div className="px-3 pb-3 pt-2 bg-dorado/5 border-t border-dorado/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Hijos vinculados ({hijosStaff.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setBuscarHijoModal(true)}
                        className="flex items-center gap-1 text-xs font-medium text-dorado hover:text-dorado/80 transition-colors"
                      >
                        <Plus size={12} /> Agregar
                      </button>
                    </div>

                    {hijosStaff.length === 0 ? (
                      <p className="text-xs text-gray-400 italic py-1">Sin hijos vinculados aún</p>
                    ) : (
                      <div className="space-y-1.5">
                        {hijosStaff.map(h => (
                          <div key={h.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-dorado/10">
                            <div>
                              <p className="text-xs font-medium text-gray-800">{h.nombre} {h.apellido}</p>
                              <p className="text-[10px] text-gray-400">{h.nivel} · {formatGradoSeccion(h.nivel, h.grado, h.seccion)} · DNI {h.dni}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => desvincularHijo(h)}
                              disabled={operandoHijo}
                              className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setModalEditar(false)} className="btn-secondary flex-1">Cancelar</button>
              <button type="submit" disabled={guardando} className="btn-primary flex-1">
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </ModalBase>
      )}

      {/* ── Modal: Cambiar Contraseña ── */}
      {modalPass && usuarioPass && (
        <ModalBase titulo="Cambiar Contraseña" onClose={() => setModalPass(false)}>
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-100">
            <p className="text-sm text-amber-800 font-medium">{usuarioPass.nombre} {usuarioPass.apellido}</p>
            <p className="text-xs text-amber-600 mt-0.5">{usuarioPass.email}</p>
          </div>
          <form onSubmit={handlePassword} className="space-y-3">
            <Campo label="Nueva contraseña">
              <input
                type="password"
                className="input"
                value={nuevaPass}
                onChange={(e) => setNuevaPass(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                required
              />
            </Campo>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setModalPass(false)} className="btn-secondary flex-1">Cancelar</button>
              <button type="submit" disabled={cambiandoPass} className="btn-primary flex-1">
                {cambiandoPass ? 'Guardando...' : 'Cambiar contraseña'}
              </button>
            </div>
          </form>
        </ModalBase>
      )}

      {/* ── Modal: Buscar y vincular hijo ── */}
      {buscarHijoModal && (
        <ModalBase titulo="Agregar hijo" onClose={cerrarBuscarHijo}>
          <div className="space-y-3">
            <Campo label="Buscar estudiante">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="input pl-8"
                  placeholder="Nombre, apellido o DNI..."
                  value={busquedaHijo}
                  onChange={e => setBusquedaHijo(e.target.value)}
                  autoFocus
                />
              </div>
            </Campo>

            <div className="min-h-[120px] max-h-64 overflow-y-auto">
              {cargandoEstudiantes ? (
                <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
                  <span className="animate-spin w-4 h-4 border-2 border-dorado border-t-transparent rounded-full mr-2" />
                  Cargando estudiantes...
                </div>
              ) : estudiantesFiltrados.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">Sin resultados</p>
              ) : (
                <div className="space-y-1.5">
                  {!busquedaHijo.trim() && (
                    <p className="text-[11px] text-gray-400 px-1 pb-1">
                      Mostrando primeros {estudiantesFiltrados.length} — escribe para filtrar
                    </p>
                  )}
                  {estudiantesFiltrados.map(est => (
                    <button
                      key={est.id}
                      type="button"
                      onClick={() => vincularHijo(est)}
                      disabled={operandoHijo}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-100 hover:border-dorado/40 hover:bg-dorado/5 transition-colors text-left disabled:opacity-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">{est.nombre} {est.apellido}</p>
                        <p className="text-xs text-gray-400">{est.nivel} · {formatGradoSeccion(est.nivel, est.grado, est.seccion)} · DNI {est.dni}</p>
                      </div>
                      <Plus size={15} className="text-dorado flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button type="button" onClick={cerrarBuscarHijo} className="btn-secondary w-full">
              Cerrar
            </button>
          </div>
        </ModalBase>
      )}
    </div>
  )
}

/* ── Componentes auxiliares ── */
function ModalBase({ titulo, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-marino text-base">{titulo}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Campo({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  )
}
