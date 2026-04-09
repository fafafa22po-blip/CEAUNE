import { useState, useEffect } from 'react'
import {
  User, Mail, CreditCard, Calendar, Lock,
  Eye, EyeOff, BookOpen, Users, Shield, RefreshCw,
} from 'lucide-react'
import api from '../lib/api'
import { formatGradoSeccion, formatGrado } from '../lib/nivelAcademico'
import { obtenerUsuario, guardarSesion } from '../lib/auth'
import toast from 'react-hot-toast'

const ROL_LABEL = {
  admin:       'Administrador',
  tutor:       'Tutor de Aula',
  apoderado:   'Apoderado',
  'i-auxiliar': 'Auxiliar – Inicial',
  'p-auxiliar': 'Auxiliar – Primaria',
  's-auxiliar': 'Auxiliar – Secundaria',
}

export default function Perfil() {
  const [perfil, setPerfil]   = useState(null)
  const [extras, setExtras]   = useState(null)
  const [cargando, setCargando] = useState(true)

  // edición de datos personales
  const [editando, setEditando]   = useState(false)
  const [form, setForm]           = useState({ nombre: '', apellido: '', email: '' })
  const [guardando, setGuardando] = useState(false)

  // cambio de contraseña
  const [pwd, setPwd]             = useState({ actual: '', nuevo: '', confirmar: '' })
  const [mostrarPwd, setMostrarPwd] = useState(false)
  const [cambiandoPwd, setCambiandoPwd] = useState(false)

  const cargar = async () => {
    setCargando(true)
    try {
      const { data } = await api.get('/auth/me')
      setPerfil(data)
      setForm({ nombre: data.nombre, apellido: data.apellido, email: data.email })

      if (data.rol === 'tutor') {
        try {
          const r = await api.get('/tutor/mi-aula')
          setExtras({ tipo: 'tutor', aula: r.data })
        } catch {
          setExtras({ tipo: 'tutor', aula: null })
        }
      } else if (data.rol === 'apoderado') {
        try {
          const r = await api.get('/apoderado/mis-hijos')
          setExtras({ tipo: 'apoderado', hijos: r.data })
        } catch {
          setExtras({ tipo: 'apoderado', hijos: [] })
        }
      } else if (['i-auxiliar', 'p-auxiliar', 's-auxiliar'].includes(data.rol)) {
        setExtras({ tipo: 'auxiliar' })
      }
    } catch {
      toast.error('Error al cargar el perfil')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const cancelarEdicion = () => {
    setForm({ nombre: perfil.nombre, apellido: perfil.apellido, email: perfil.email })
    setEditando(false)
  }

  const guardarPerfil = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim() || !form.apellido.trim() || !form.email.trim()) {
      toast.error('Completa todos los campos')
      return
    }
    setGuardando(true)
    try {
      const { data } = await api.put('/auth/perfil', form)
      setPerfil(data)
      const token = localStorage.getItem('token')
      guardarSesion(token, data)
      setEditando(false)
      toast.success('Perfil actualizado')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const cambiarPassword = async (e) => {
    e.preventDefault()
    if (pwd.nuevo !== pwd.confirmar) {
      toast.error('Las contraseñas nuevas no coinciden')
      return
    }
    if (pwd.nuevo.length < 6) {
      toast.error('La contraseña nueva debe tener al menos 6 caracteres')
      return
    }
    setCambiandoPwd(true)
    try {
      await api.post('/auth/cambiar-password', {
        password_actual: pwd.actual,
        password_nuevo:  pwd.nuevo,
      })
      setPwd({ actual: '', nuevo: '', confirmar: '' })
      toast.success('Contraseña cambiada correctamente')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cambiar contraseña')
    } finally {
      setCambiandoPwd(false)
    }
  }

  if (cargando) return (
    <div className="flex items-center justify-center h-48 text-gray-400">
      <span className="animate-spin w-5 h-5 border-2 border-dorado border-t-transparent rounded-full mr-3" />
      Cargando perfil...
    </div>
  )

  if (!perfil) return null

  const iniciales = `${perfil.nombre?.charAt(0) ?? ''}${perfil.apellido?.charAt(0) ?? ''}`.toUpperCase()
  const fechaAlta = new Date(perfil.created_at).toLocaleDateString('es-PE', {
    year: 'numeric', month: 'long',
  })

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-marino">Mi Perfil</h1>
        <button onClick={cargar} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* ── Tarjeta resumen ── */}
      <div className="card flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-marino text-white flex items-center justify-center text-xl font-bold flex-shrink-0 select-none">
          {iniciales}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold text-marino truncate">
            {perfil.nombre} {perfil.apellido}
          </p>
          <p className="text-sm font-medium text-dorado">{ROL_LABEL[perfil.rol] ?? perfil.rol}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <CreditCard size={11} /> DNI: {perfil.dni}
            </span>
            <span className="flex items-center gap-1">
              <Calendar size={11} /> Miembro desde {fechaAlta}
            </span>
          </div>
        </div>
      </div>

      {/* ── Información Personal ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-marino flex items-center gap-2">
            <User size={16} /> Información Personal
          </h2>
          {!editando && (
            <button onClick={() => setEditando(true)} className="btn-secondary text-sm">
              Editar
            </button>
          )}
        </div>

        {editando ? (
          <form onSubmit={guardarPerfil} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                <input
                  className="input"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Nombre"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Apellido</label>
                <input
                  className="input"
                  value={form.apellido}
                  onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))}
                  placeholder="Apellido"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={guardando} className="btn-primary text-sm">
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button type="button" onClick={cancelarEdicion} className="btn-secondary text-sm">
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <dl className="divide-y divide-gray-50">
            {[
              { icon: User, label: 'Nombre',   value: perfil.nombre },
              { icon: User, label: 'Apellido',  value: perfil.apellido },
              { icon: Mail, label: 'Email',     value: perfil.email },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 py-2.5">
                <Icon size={14} className="text-gray-400 flex-shrink-0" />
                <span className="text-xs text-gray-400 w-20 flex-shrink-0">{label}</span>
                <span className="text-sm text-gray-800 font-medium">{value}</span>
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* ── Info específica por rol ── */}

      {extras?.tipo === 'tutor' && (
        <div className="card">
          <h2 className="font-semibold text-marino flex items-center gap-2 mb-3">
            <BookOpen size={16} /> Aula Asignada
          </h2>
          {extras.aula ? (
            <div className="flex items-center gap-4 bg-blue-50 rounded-lg px-4 py-3">
              <div className="w-10 h-10 rounded-full bg-marino text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                {formatGrado(extras.aula.nivel, extras.aula.grado)}
              </div>
              <div>
                <p className="font-semibold text-marino">
                  {formatGradoSeccion(extras.aula.nivel, extras.aula.grado, extras.aula.seccion)}
                </p>
                <p className="text-xs text-gray-500 capitalize">{extras.aula.nivel}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Sin aula asignada</p>
          )}
        </div>
      )}

      {extras?.tipo === 'apoderado' && (
        <div className="card">
          <h2 className="font-semibold text-marino flex items-center gap-2 mb-3">
            <Users size={16} /> Mis Hijos
          </h2>
          {extras.hijos?.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {extras.hijos.map(h => (
                <div key={h.id} className="flex items-center gap-3 py-2.5">
                  <div className="w-8 h-8 rounded-full bg-dorado text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {h.nombre?.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {h.nombre} {h.apellido}
                    </p>
                    <p className="text-xs text-gray-400 capitalize">
                      {h.nivel} · {formatGradoSeccion(h.nivel, h.grado, h.seccion)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Sin hijos registrados</p>
          )}
        </div>
      )}

      {extras?.tipo === 'auxiliar' && (
        <div className="card">
          <h2 className="font-semibold text-marino flex items-center gap-2 mb-3">
            <Shield size={16} /> Nivel Asignado
          </h2>
          <div className="bg-yellow-50 rounded-lg px-4 py-3">
            <span className="text-sm font-semibold text-marino capitalize">
              {perfil.nivel ?? 'Sin nivel asignado'}
            </span>
          </div>
        </div>
      )}

      {/* ── Cambiar Contraseña ── */}
      <div className="card">
        <h2 className="font-semibold text-marino flex items-center gap-2 mb-4">
          <Lock size={16} /> Cambiar Contraseña
        </h2>
        <form onSubmit={cambiarPassword} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Contraseña actual</label>
            <input
              type={mostrarPwd ? 'text' : 'password'}
              className="input"
              value={pwd.actual}
              onChange={e => setPwd(p => ({ ...p, actual: e.target.value }))}
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nueva contraseña</label>
            <input
              type={mostrarPwd ? 'text' : 'password'}
              className="input"
              value={pwd.nuevo}
              onChange={e => setPwd(p => ({ ...p, nuevo: e.target.value }))}
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Confirmar nueva contraseña</label>
            <input
              type={mostrarPwd ? 'text' : 'password'}
              className="input"
              value={pwd.confirmar}
              onChange={e => setPwd(p => ({ ...p, confirmar: e.target.value }))}
              placeholder="••••••••"
            />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={cambiandoPwd || !pwd.actual || !pwd.nuevo || !pwd.confirmar}
              className="btn-primary text-sm"
            >
              {cambiandoPwd ? 'Cambiando...' : 'Cambiar contraseña'}
            </button>
            <button
              type="button"
              onClick={() => setMostrarPwd(v => !v)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              {mostrarPwd ? <EyeOff size={13} /> : <Eye size={13} />}
              {mostrarPwd ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </form>
      </div>

    </div>
  )
}
