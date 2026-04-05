import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Search, Plus, X, RefreshCw, Pencil, Key, UserMinus, UserPlus,
  Link2, Unlink, UserCheck, Phone, PhoneOff, Mail, Copy, RotateCcw,
  GraduationCap,
} from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { abrirWhatsApp } from '../../lib/externo'

function IconWhatsApp({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

function PanelContacto({ apo, onClose, onGestionarHijos }) {
  const [mensaje, setMensaje] = useState('')
  const backdropRef = useRef()

  const mensajeDefault = useMemo(
    () => `Estimado/a ${apo.nombre} ${apo.apellido},\nLe contactamos del *Colegio CEAUNE*.\n\n_Administración_`,
    [apo.id], // eslint-disable-line
  )

  useEffect(() => {
    setMensaje(mensajeDefault)
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [apo.id, mensajeDefault])

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  const copiar = () => {
    navigator.clipboard.writeText(`+51${apo.telefono}`)
    toast.success('Número copiado')
  }

  return (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,31,61,0.55)', backdropFilter: 'blur(4px)' }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[88vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-marino px-5 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-base">
                  {apo.nombre?.[0]}{apo.apellido?.[0]}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-white font-bold text-base leading-tight">{apo.nombre} {apo.apellido}</p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    apo.activo ? 'bg-green-400/30 text-green-200' : 'bg-red-400/30 text-red-200'
                  }`}>
                    {apo.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <p className="text-white/60 text-xs mt-0.5 font-mono">DNI {apo.dni}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
            >
              <X size={16} className="text-white" />
            </button>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Contacto */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Mail size={12} /> Contacto
            </p>
            <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5">
              <p className="text-sm text-gray-600 flex items-center gap-2">
                <Mail size={13} className="text-gray-400 flex-shrink-0" />
                <span className="truncate">{apo.email}</span>
              </p>
              {apo.telefono ? (
                <p className="text-sm text-green-700 font-medium flex items-center gap-2">
                  <Phone size={13} className="flex-shrink-0" />
                  +51 {apo.telefono}
                </p>
              ) : (
                <p className="text-sm text-gray-400 flex items-center gap-2">
                  <PhoneOff size={13} className="flex-shrink-0" />
                  Sin número registrado
                </p>
              )}
            </div>
            {apo.telefono && (
              <div className="flex gap-2">
                <button
                  onClick={copiar}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium rounded-lg transition-colors flex-1"
                >
                  <Copy size={12} /> Copiar
                </button>
                <a
                  href={`tel:+51${apo.telefono}`}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-medium rounded-lg transition-colors flex-1"
                >
                  <Phone size={12} /> Llamar
                </a>
              </div>
            )}
          </div>

          {/* Hijos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <GraduationCap size={12} /> Hijos ({apo.hijos?.length || 0})
              </p>
              <button
                onClick={() => onGestionarHijos(apo)}
                className="text-xs text-marino hover:underline"
              >
                Gestionar →
              </button>
            </div>
            {apo.hijos?.length > 0 ? (
              <div className="space-y-1.5">
                {apo.hijos.map(h => (
                  <div key={h.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${NIVEL_BADGE[h.nivel]?.cls || 'bg-gray-200 text-gray-600'}`}>
                      {h.nombre?.[0]}{h.apellido?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{h.nombre} {h.apellido}</p>
                      <p className="text-xs text-gray-400">{h.grado}° {h.seccion} · {h.nivel}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-amber-500 text-center bg-amber-50 rounded-xl py-3">
                Sin hijos vinculados
              </p>
            )}
          </div>

          {/* WhatsApp */}
          {apo.telefono && (
            <div className="space-y-2 border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <IconWhatsApp size={12} /> Mensaje WhatsApp
                </p>
                <button
                  onClick={() => setMensaje(mensajeDefault)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-marino transition-colors"
                >
                  <RotateCcw size={11} /> Restaurar
                </button>
              </div>
              <div className="relative">
                <textarea
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-green-400/40 focus:border-green-400 transition-all bg-gray-50"
                  rows={4}
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                />
                <span className="absolute bottom-2.5 right-3 text-xs text-gray-300">{mensaje.length}</span>
              </div>
              <button
                onClick={() => abrirWhatsApp(apo.telefono, mensaje)}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
              >
                <IconWhatsApp size={16} /> Enviar por WhatsApp
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/80 flex justify-end rounded-b-2xl flex-shrink-0">
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700 font-medium px-4 py-1.5 rounded-xl hover:bg-gray-200 transition-colors"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  )
}

const NIVEL_BADGE = {
  inicial:    { label: 'Ini', cls: 'bg-green-100 text-green-700' },
  primaria:   { label: 'Pri', cls: 'bg-blue-100 text-blue-700' },
  secundaria: { label: 'Sec', cls: 'bg-purple-100 text-purple-700' },
}

const FORM_INICIAL = {
  dni: '', nombre: '', apellido: '', email: '', password: '', telefono: '',
}

export default function Apoderados() {
  const [lista, setLista]       = useState([])
  const [total, setTotal]       = useState(0)
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroActivo, setFiltroActivo] = useState('')

  // Modal nuevo apoderado
  const [modalNuevo, setModalNuevo] = useState(false)
  const [form, setForm]             = useState(FORM_INICIAL)
  const [creando, setCreando]       = useState(false)

  // Modal editar
  const [modalEditar, setModalEditar]   = useState(null)
  const [formEditar, setFormEditar]     = useState({})
  const [guardando, setGuardando]       = useState(false)

  // Modal contraseña
  const [modalPass, setModalPass]       = useState(null)
  const [nuevaPass, setNuevaPass]       = useState('')
  const [cambiandoPass, setCambiandoPass] = useState(false)

  // Panel de contacto (click en fila)
  const [panelApo, setPanelApo]             = useState(null)

  // Modal gestión de hijos
  const [modalHijos, setModalHijos]         = useState(null)
  const [busqEst, setBusqEst]               = useState('')
  const [resultadosEst, setResultadosEst]   = useState([])
  const [buscandoEst, setBuscandoEst]       = useState(false)
  const [vinculando, setVinculando]         = useState(null)
  const [desvinculando, setDesvinculando]   = useState(null)

  // ── Carga principal ───────────────────────────────────────────────────
  const cargar = async () => {
    setCargando(true)
    try {
      const params = {}
      if (busqueda.trim()) params.q = busqueda.trim()
      if (filtroActivo === 'activo')   params.activo = true
      if (filtroActivo === 'inactivo') params.activo = false

      const { data } = await api.get('/admin/apoderados', { params })
      const items = Array.isArray(data) ? data : (data.items || [])
      setLista(items)
      setTotal(Array.isArray(data) ? data.length : (data.total ?? items.length))
    } catch {
      toast.error('Error al cargar apoderados')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(cargar, 300)
    return () => clearTimeout(t)
  }, [busqueda, filtroActivo])

  // ── CRUD apoderado ────────────────────────────────────────────────────
  const setField = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }))

  const handleCrear = async (e) => {
    e.preventDefault()
    setCreando(true)
    try {
      await api.post('/admin/usuarios', {
        ...form,
        rol: 'apoderado',
        telefono: form.telefono || undefined,
      })
      toast.success('Apoderado creado')
      setModalNuevo(false)
      setForm(FORM_INICIAL)
      cargar()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al crear')
    } finally {
      setCreando(false)
    }
  }

  const abrirEditar = (apo) => {
    setFormEditar({
      dni: apo.dni, nombre: apo.nombre, apellido: apo.apellido,
      email: apo.email, telefono: apo.telefono || '',
    })
    setModalEditar(apo)
  }

  const handleEditar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try {
      await api.put(`/admin/usuarios/${modalEditar.id}`, formEditar)
      toast.success('Datos actualizados')
      setModalEditar(null)
      cargar()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al actualizar')
    } finally {
      setGuardando(false)
    }
  }

  const handleToggleActivo = async (apo) => {
    try {
      if (apo.activo) {
        await api.delete(`/admin/usuarios/${apo.id}`)
        toast.success(`${apo.nombre} desactivado`)
      } else {
        await api.put(`/admin/usuarios/${apo.id}`, { activo: true })
        toast.success(`${apo.nombre} activado`)
      }
      cargar()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cambiar estado')
    }
  }

  const handleCambiarPass = async (e) => {
    e.preventDefault()
    if (nuevaPass.length < 6) return toast.error('Mínimo 6 caracteres')
    setCambiandoPass(true)
    try {
      await api.put(`/admin/usuarios/${modalPass.id}/password`, { nueva_password: nuevaPass })
      toast.success('Contraseña actualizada')
      setModalPass(null)
      setNuevaPass('')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cambiar contraseña')
    } finally {
      setCambiandoPass(false)
    }
  }

  // ── Gestión de hijos ──────────────────────────────────────────────────
  const abrirHijos = (apo) => {
    setModalHijos(apo)
    setBusqEst('')
    setResultadosEst([])
  }

  const buscarEstudiantes = async (q) => {
    setBusqEst(q)
    if (!q.trim() || q.length < 2) { setResultadosEst([]); return }
    setBuscandoEst(true)
    try {
      const { data } = await api.get('/estudiantes/', { params: { q: q.trim() } })
      setResultadosEst(Array.isArray(data) ? data : (data.items || []))
    } catch {
      setResultadosEst([])
    } finally {
      setBuscandoEst(false)
    }
  }

  const vincularHijo = async (estudiante) => {
    setVinculando(estudiante.id)
    try {
      await api.post(`/admin/apoderados/${modalHijos.id}/hijos/${estudiante.id}`)
      toast.success(`${estudiante.nombre} vinculado`)
      const updated = { ...modalHijos, hijos: [...modalHijos.hijos, estudiante] }
      setModalHijos(updated)
      setLista(lista.map(a => a.id === modalHijos.id ? updated : a))
      setBusqEst('')
      setResultadosEst([])
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al vincular')
    } finally {
      setVinculando(null)
    }
  }

  const desvincularHijo = async (hijo) => {
    setDesvinculando(hijo.id)
    try {
      await api.delete(`/admin/apoderados/${modalHijos.id}/hijos/${hijo.id}`)
      toast.success(`${hijo.nombre} desvinculado`)
      const updated = { ...modalHijos, hijos: modalHijos.hijos.filter(h => h.id !== hijo.id) }
      setModalHijos(updated)
      setLista(lista.map(a => a.id === modalHijos.id ? updated : a))
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al desvincular')
    } finally {
      setDesvinculando(null)
    }
  }

  // Estudiantes que aún no están vinculados al apoderado activo
  const hijosIds = new Set(modalHijos?.hijos?.map(h => h.id) || [])
  const resultadosFiltrados = resultadosEst.filter(e => !hijosIds.has(e.id))

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-marino">Apoderados</h1>
          {!cargando && (
            <p className="text-xs text-gray-400 mt-0.5">
              {total} apoderado{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={cargar} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={14} /> Actualizar
          </button>
          <button onClick={() => setModalNuevo(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} /> Nuevo apoderado
          </button>
        </div>
      </div>

      {/* Buscador + filtro */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-8"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o DNI..."
          />
        </div>
        <select
          className="input text-sm py-1.5"
          style={{ width: 'auto' }}
          value={filtroActivo}
          onChange={(e) => setFiltroActivo(e.target.value)}
        >
          <option value="">Todos</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-gray-100">
              {['Apoderado', 'DNI', 'Contacto', 'Hijos vinculados', 'Estado', 'Acciones'].map(h => (
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
                <td colSpan={6} className="text-center text-gray-400 py-8">
                  Sin apoderados registrados
                </td>
              </tr>
            ) : (
              lista.map(apo => (
                <tr
                  key={apo.id}
                  className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setPanelApo(apo)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{apo.nombre} {apo.apellido}</div>
                    <div className="text-xs text-gray-400 truncate max-w-[180px]">{apo.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{apo.dni}</td>
                  <td className="px-4 py-3">
                    {apo.telefono ? (
                      <span className="flex items-center gap-1 text-xs text-gray-600">
                        <Phone size={11} className="flex-shrink-0" /> {apo.telefono}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {apo.hijos?.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {apo.hijos.map(h => (
                          <span
                            key={h.id}
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${NIVEL_BADGE[h.nivel]?.cls || 'bg-gray-100 text-gray-600'}`}
                          >
                            {h.nombre} {h.grado}°{h.seccion}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-amber-500 font-medium">Sin hijos vinculados</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={apo.activo ? 'badge-verde' : 'badge-rojo'}>
                      {apo.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => abrirHijos(apo)}
                        title="Gestionar hijos"
                        className="p-1.5 rounded-lg text-marino hover:bg-blue-50 transition-colors"
                      >
                        <UserCheck size={14} />
                      </button>
                      <button
                        onClick={() => abrirEditar(apo)}
                        title="Editar datos"
                        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => { setModalPass(apo); setNuevaPass('') }}
                        title="Cambiar contraseña"
                        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                      >
                        <Key size={14} />
                      </button>
                      <button
                        onClick={() => handleToggleActivo(apo)}
                        title={apo.activo ? 'Desactivar' : 'Activar'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          apo.activo
                            ? 'text-red-400 hover:bg-red-50'
                            : 'text-green-500 hover:bg-green-50'
                        }`}
                      >
                        {apo.activo ? <UserMinus size={14} /> : <UserPlus size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Modal: Nuevo Apoderado ─────────────────────────────────────── */}
      {modalNuevo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-marino">Nuevo Apoderado</h3>
              <button onClick={() => { setModalNuevo(false); setForm(FORM_INICIAL) }}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleCrear} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
                  <input className="input" value={form.nombre} onChange={setField('nombre')} placeholder="María" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Apellido</label>
                  <input className="input" value={form.apellido} onChange={setField('apellido')} placeholder="López" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">DNI</label>
                <input
                  className="input"
                  value={form.dni}
                  onChange={(e) => setForm(p => ({ ...p, dni: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                  placeholder="45678901"
                  maxLength={8}
                  inputMode="numeric"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input type="email" className="input" value={form.email} onChange={setField('email')} placeholder="correo@gmail.com" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Contraseña inicial</label>
                <input type="password" className="input" value={form.password} onChange={setField('password')} placeholder="Mínimo 6 caracteres" minLength={6} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  WhatsApp <span className="text-gray-400">(opcional)</span>
                </label>
                <input
                  className="input"
                  value={form.telefono}
                  onChange={(e) => setForm(p => ({ ...p, telefono: e.target.value.replace(/\D/g, '').slice(0, 9) }))}
                  placeholder="987654321"
                  inputMode="numeric"
                />
              </div>
              <p className="text-xs text-gray-400 pt-1">
                Los hijos se pueden vincular después desde la tabla.
              </p>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setModalNuevo(false); setForm(FORM_INICIAL) }}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={creando} className="btn-primary flex-1">
                  {creando ? 'Creando...' : 'Crear apoderado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Editar Apoderado ───────────────────────────────────── */}
      {modalEditar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-marino">Editar Apoderado</h3>
              <button onClick={() => setModalEditar(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleEditar} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
                  <input
                    className="input"
                    value={formEditar.nombre}
                    onChange={e => setFormEditar(f => ({ ...f, nombre: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Apellido</label>
                  <input
                    className="input"
                    value={formEditar.apellido}
                    onChange={e => setFormEditar(f => ({ ...f, apellido: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">DNI</label>
                <input
                  className="input"
                  value={formEditar.dni}
                  onChange={e => setFormEditar(f => ({ ...f, dni: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                  maxLength={8}
                  inputMode="numeric"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  className="input"
                  value={formEditar.email}
                  onChange={e => setFormEditar(f => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  WhatsApp <span className="text-gray-400">(opcional)</span>
                </label>
                <input
                  className="input"
                  value={formEditar.telefono}
                  onChange={e => setFormEditar(f => ({ ...f, telefono: e.target.value.replace(/\D/g, '').slice(0, 9) }))}
                  placeholder="987654321"
                  inputMode="numeric"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalEditar(null)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={guardando} className="btn-primary flex-1">
                  {guardando ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Cambiar Contraseña ─────────────────────────────────── */}
      {modalPass && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-marino">Cambiar Contraseña</h3>
              <button onClick={() => setModalPass(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Nueva contraseña para{' '}
              <span className="font-semibold text-gray-700">{modalPass.nombre} {modalPass.apellido}</span>
            </p>
            <form onSubmit={handleCambiarPass} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nueva contraseña</label>
                <input
                  type="password"
                  className="input"
                  value={nuevaPass}
                  onChange={e => setNuevaPass(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required
                  autoFocus
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalPass(null)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={cambiandoPass} className="btn-primary flex-1">
                  {cambiandoPass ? 'Guardando...' : 'Actualizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Gestionar Hijos ────────────────────────────────────── */}
      {modalHijos && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-marino">Gestionar hijos vinculados</h3>
              <button onClick={() => setModalHijos(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              {modalHijos.nombre} {modalHijos.apellido}
            </p>

            {/* Hijos actuales */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Hijos registrados ({modalHijos.hijos.length})
              </p>
              {modalHijos.hijos.length === 0 ? (
                <p className="text-sm text-gray-400 bg-gray-50 rounded-xl p-4 text-center">
                  Sin hijos vinculados aún
                </p>
              ) : (
                <div className="space-y-2">
                  {modalHijos.hijos.map(h => {
                    const badge = NIVEL_BADGE[h.nivel]
                    return (
                      <div key={h.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <div>
                          <p className="font-medium text-gray-800 text-sm">{h.nombre} {h.apellido}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {h.grado}° {h.seccion}
                            {badge && (
                              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${badge.cls}`}>
                                {badge.label}
                              </span>
                            )}
                            {' · '}DNI {h.dni}
                          </p>
                        </div>
                        <button
                          onClick={() => desvincularHijo(h)}
                          disabled={desvinculando === h.id}
                          title="Desvincular"
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors disabled:opacity-40"
                        >
                          {desvinculando === h.id ? (
                            <span className="block w-4 h-4 border-2 border-red-300 border-t-red-500 rounded-full animate-spin" />
                          ) : (
                            <Unlink size={14} />
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Vincular alumno */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Vincular alumno
              </p>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="input pl-8"
                  value={busqEst}
                  onChange={e => buscarEstudiantes(e.target.value)}
                  placeholder="Buscar alumno por nombre o DNI..."
                />
              </div>

              {buscandoEst && (
                <p className="text-xs text-gray-400 text-center mt-2 py-2">Buscando...</p>
              )}

              {resultadosFiltrados.length > 0 && (
                <div className="mt-2 border border-gray-100 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                  {resultadosFiltrados.map(est => {
                    const badge = NIVEL_BADGE[est.nivel]
                    return (
                      <div
                        key={est.id}
                        className="flex items-center justify-between px-3 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0"
                      >
                        <div>
                          <p className="font-medium text-gray-800 text-sm">{est.nombre} {est.apellido}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {est.grado}° {est.seccion}
                            {badge && (
                              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${badge.cls}`}>
                                {badge.label}
                              </span>
                            )}
                            {' · '}DNI {est.dni}
                          </p>
                        </div>
                        <button
                          onClick={() => vincularHijo(est)}
                          disabled={vinculando === est.id}
                          className="flex items-center gap-1.5 text-xs font-medium text-white bg-marino hover:bg-marino/90 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0 ml-3"
                        >
                          {vinculando === est.id ? (
                            'Vinculando...'
                          ) : (
                            <><Link2 size={12} /> Vincular</>
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {busqEst.length >= 2 && !buscandoEst && resultadosFiltrados.length === 0 && (
                <p className="text-xs text-gray-400 text-center mt-2 py-2">Sin resultados</p>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button onClick={() => setModalHijos(null)} className="btn-secondary text-sm">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Panel de contacto (click en fila) ────────────────────────── */}
      {panelApo && (
        <PanelContacto
          apo={lista.find(a => a.id === panelApo.id) || panelApo}
          onClose={() => setPanelApo(null)}
          onGestionarHijos={(apo) => abrirHijos(apo)}
        />
      )}

    </div>
  )
}
