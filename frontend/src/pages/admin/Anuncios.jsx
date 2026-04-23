import { useState, useEffect, useRef } from 'react'
import {
  ImagePlus, Trash2, Eye, EyeOff, CalendarDays,
  Users, X, Check, Loader2, ImageOff,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'

const imgSrc = (anuncio) => `${api.defaults.baseURL}/anuncios/imagen/${anuncio.id}`
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const NIVEL_LABEL = {
  todos:      'Todos los niveles',
  inicial:    'Solo Inicial',
  primaria:   'Solo Primaria',
  secundaria: 'Solo Secundaria',
}

const NIVEL_COLOR = {
  todos:      'bg-marino/10 text-marino',
  inicial:    'bg-emerald-100 text-emerald-700',
  primaria:   'bg-blue-100 text-blue-700',
  secundaria: 'bg-amber-100 text-amber-700',
}

function hoy() {
  return format(new Date(), 'yyyy-MM-dd')
}

// ── Formulario nuevo anuncio ──────────────────────────────────────────────────

function FormNuevoAnuncio({ onCreado, onCancelar }) {
  const [titulo,      setTitulo]      = useState('')
  const [nivel,       setNivel]       = useState('todos')
  const [fechaInicio, setFechaInicio] = useState(hoy())
  const [fechaFin,    setFechaFin]    = useState(hoy())
  const [imagen,      setImagen]      = useState(null)    // File
  const [preview,     setPreview]     = useState(null)    // URL local
  const [subiendo,    setSubiendo]    = useState(false)
  const [guardando,   setGuardando]   = useState(false)
  const fileRef = useRef()

  const seleccionarImagen = (e) => {
    const f = e.target.files[0]
    if (!f) return
    if (!f.type.startsWith('image/')) { toast.error('Solo se permiten imágenes'); return }
    if (f.size > 10 * 1024 * 1024)   { toast.error('La imagen no puede superar 10 MB'); return }
    setImagen(f)
    setPreview(URL.createObjectURL(f))
  }

  const guardar = async () => {
    if (!imagen)         { toast.error('Selecciona una imagen'); return }
    if (!fechaInicio)    { toast.error('Indica la fecha de inicio'); return }
    if (!fechaFin)       { toast.error('Indica la fecha de fin'); return }
    if (fechaFin < fechaInicio) { toast.error('La fecha de fin debe ser posterior al inicio'); return }

    setSubiendo(true)
    let imagen_url    = ''
    let imagen_nombre = imagen.name
    try {
      const fd = new FormData()
      fd.append('archivo', imagen)
      const { data: dr } = await api.post('/anuncios/subir-imagen', fd)
      imagen_url    = dr.url
      imagen_nombre = dr.nombre || imagen.name
    } catch {
      toast.error('Error al subir la imagen')
      setSubiendo(false)
      return
    }
    setSubiendo(false)
    setGuardando(true)
    try {
      await api.post('/anuncios/', {
        titulo:        titulo.trim() || null,
        imagen_url,
        imagen_nombre,
        nivel,
        fecha_inicio:  fechaInicio,
        fecha_fin:     fechaFin,
      })
      toast.success('Anuncio publicado')
      onCreado()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const cargando = subiendo || guardando
  const labelBtn = subiendo ? 'Subiendo imagen...' : guardando ? 'Publicando...' : 'Publicar anuncio'

  return (
    <div className="card space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-marino">Nuevo anuncio</h2>
        <button onClick={onCancelar} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
          <X size={16} />
        </button>
      </div>

      {/* Imagen */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-2">
          Imagen <span className="text-red-500">*</span>
        </label>
        {preview ? (
          <div className="relative rounded-2xl overflow-hidden bg-gray-100" style={{ aspectRatio: '16/7' }}>
            <img src={preview} alt="preview" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => { setImagen(null); setPreview(null) }}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-200 hover:border-dorado rounded-2xl transition-colors group"
            style={{ aspectRatio: '16/7' }}
          >
            <div className="w-14 h-14 bg-gray-100 group-hover:bg-dorado/10 rounded-2xl flex items-center justify-center transition-colors">
              <ImagePlus size={24} className="text-gray-400 group-hover:text-dorado transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-600">Subir imagen</p>
              <p className="text-xs text-gray-400 mt-0.5">JPG, PNG · Proporción 16:7 recomendada · máx. 10 MB</p>
            </div>
          </button>
        )}
        <input ref={fileRef} type="file" className="hidden" accept="image/*" onChange={seleccionarImagen} />
      </div>

      {/* Título opcional */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
          Título <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <input
          className="input"
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          placeholder="Ej: Día del Padre — ¡Celebremos juntos!"
          maxLength={200}
        />
      </div>

      {/* Nivel */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-2">
          Mostrar a
        </label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(NIVEL_LABEL).map(([val, lbl]) => (
            <button
              key={val}
              type="button"
              onClick={() => setNivel(val)}
              className={`py-2.5 px-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                nivel === val
                  ? 'border-marino bg-marino/5 text-marino'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Fechas */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Desde</label>
          <input type="date" className="input" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Hasta</label>
          <input type="date" className="input" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
        </div>
      </div>

      {/* Botones */}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancelar} className="btn-secondary flex-1">
          Cancelar
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={cargando || !imagen}
          className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {cargando
            ? <><Loader2 size={15} className="animate-spin" /> {labelBtn}</>
            : <><Check size={15} /> Publicar anuncio</>
          }
        </button>
      </div>
    </div>
  )
}

// ── Card de anuncio existente ─────────────────────────────────────────────────

function CardAnuncio({ anuncio, onToggle, onEliminar }) {
  const [confirmando, setConfirmando] = useState(false)
  const hoyStr = hoy()
  const vigente = anuncio.activo && anuncio.fecha_inicio <= hoyStr && anuncio.fecha_fin >= hoyStr
  const expirado = anuncio.fecha_fin < hoyStr

  return (
    <div className={`card p-0 overflow-hidden transition-opacity ${!anuncio.activo ? 'opacity-60' : ''}`}>
      {/* Imagen */}
      <div className="relative bg-gray-100" style={{ aspectRatio: '16/7' }}>
        <img
          src={imgSrc(anuncio)}
          alt={anuncio.titulo || 'Anuncio'}
          className="w-full h-full object-cover"
          onError={e => { e.target.style.display = 'none' }}
        />
        {/* Badge estado */}
        <div className="absolute top-2 left-2 flex gap-1.5">
          {vigente && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500 text-white shadow">
              Visible ahora
            </span>
          )}
          {expirado && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-500 text-white shadow">
              Expirado
            </span>
          )}
          {!anuncio.activo && !expirado && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white shadow">
              Pausado
            </span>
          )}
        </div>
        {/* Nivel badge */}
        <div className="absolute top-2 right-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow ${NIVEL_COLOR[anuncio.nivel]}`}>
            {NIVEL_LABEL[anuncio.nivel]}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="px-4 py-3 space-y-3">
        {anuncio.titulo && (
          <p className="text-sm font-semibold text-gray-800 leading-tight">{anuncio.titulo}</p>
        )}
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <CalendarDays size={12} />
          <span>
            {format(parseISO(anuncio.fecha_inicio), "d MMM", { locale: es })}
            {' — '}
            {format(parseISO(anuncio.fecha_fin), "d MMM yyyy", { locale: es })}
          </span>
        </div>

        {/* Acciones */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onToggle(anuncio.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex-1 justify-center ${
              anuncio.activo
                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
            }`}
          >
            {anuncio.activo ? <><EyeOff size={13} /> Pausar</> : <><Eye size={13} /> Activar</>}
          </button>

          {confirmando ? (
            <div className="flex gap-1.5 flex-1">
              <button
                onClick={() => onEliminar(anuncio.id)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                <Trash2 size={13} /> Confirmar
              </button>
              <button
                onClick={() => setConfirmando(false)}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmando(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors"
            >
              <Trash2 size={13} /> Eliminar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sección: fotos del panel de login ────────────────────────────────────────

function SeccionFotosLogin() {
  const [fotos,         setFotos]         = useState([])
  const [cargando,      setCargando]      = useState(true)
  const [subiendo,      setSubiendo]      = useState(false)
  const [confirmandoId, setConfirmandoId] = useState(null)
  const fileRef = useRef()

  const cargar = async () => {
    try {
      const { data } = await api.get('/login-fotos/')
      setFotos(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Error al cargar fotos del login')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const subirFoto = async (e) => {
    const f = e.target.files[0]
    if (!f) return
    if (!f.type.startsWith('image/')) { toast.error('Solo se permiten imágenes'); return }
    if (f.size > 10 * 1024 * 1024)   { toast.error('Máximo 10 MB'); return }
    setSubiendo(true)
    const fd = new FormData()
    fd.append('archivo', f)
    try {
      await api.post('/login-fotos/subir', fd)
      toast.success('Foto añadida al panel de login')
      cargar()
    } catch {
      toast.error('Error al subir la foto')
    } finally {
      setSubiendo(false)
      e.target.value = ''
    }
  }

  const eliminar = async (id) => {
    try {
      await api.delete(`/login-fotos/${id}`)
      setFotos(prev => prev.filter(f => f.id !== id))
      setConfirmandoId(null)
      toast.success('Foto eliminada')
    } catch {
      toast.error('Error al eliminar')
    }
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-marino text-sm">Panel de Bienvenida · Login</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Fotos que aparecen como fondo en la pantalla de acceso del personal (solo escritorio)
          </p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={subiendo}
          className="btn-primary flex items-center gap-2"
        >
          {subiendo
            ? <><Loader2 size={14} className="animate-spin" /> Subiendo...</>
            : <><ImagePlus size={14} /> Agregar foto</>
          }
        </button>
        <input ref={fileRef} type="file" className="hidden" accept="image/*" onChange={subirFoto} />
      </div>

      {cargando ? (
        <div className="flex gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-44 h-24 rounded-xl bg-gray-100 animate-pulse flex-shrink-0" />
          ))}
        </div>
      ) : fotos.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl py-8 flex flex-col items-center gap-2">
          <ImageOff size={22} className="text-gray-300" />
          <p className="text-sm text-gray-400 text-center">
            Sin fotos configuradas. El panel usará el fondo azul institucional por defecto.
          </p>
        </div>
      ) : (
        <div className="flex gap-3 flex-wrap">
          {fotos.map(f => (
            <div key={f.id} className="relative w-44 h-24 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 shadow-sm">
              <img
                src={`${api.defaults.baseURL}/login-fotos/imagen/${f.id}`}
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end justify-center pb-2">
                {confirmandoId === f.id ? (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => eliminar(f.id)}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-500 text-white"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setConfirmandoId(null)}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white/20 text-white"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmandoId(f.id)}
                    className="w-7 h-7 rounded-full bg-black/40 hover:bg-red-500 flex items-center justify-center text-white transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function Anuncios() {
  const [anuncios,     setAnuncios]     = useState([])
  const [cargando,     setCargando]     = useState(true)
  const [mostrando,    setMostrando]    = useState(false) // form nuevo

  const cargar = async () => {
    setCargando(true)
    try {
      const { data } = await api.get('/anuncios/admin')
      setAnuncios(data)
    } catch {
      toast.error('Error al cargar anuncios')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const toggleAnuncio = async (id) => {
    try {
      const { data } = await api.patch(`/anuncios/${id}/toggle`)
      setAnuncios(prev => prev.map(a => a.id === id ? data : a))
    } catch {
      toast.error('Error al actualizar')
    }
  }

  const eliminarAnuncio = async (id) => {
    try {
      await api.delete(`/anuncios/${id}`)
      setAnuncios(prev => prev.filter(a => a.id !== id))
      toast.success('Anuncio eliminado')
    } catch {
      toast.error('Error al eliminar')
    }
  }

  const activos   = anuncios.filter(a => a.activo)
  const inactivos = anuncios.filter(a => !a.activo)

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Panel de login */}
      <SeccionFotosLogin />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-marino">Tablón de Anuncios</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Las imágenes activas aparecen en el dashboard de los apoderados
          </p>
        </div>
        {!mostrando && (
          <button
            onClick={() => setMostrando(true)}
            className="btn-primary flex items-center gap-2"
          >
            <ImagePlus size={15} /> Nuevo anuncio
          </button>
        )}
      </div>

      {/* Formulario nuevo */}
      {mostrando && (
        <FormNuevoAnuncio
          onCreado={() => { setMostrando(false); cargar() }}
          onCancelar={() => setMostrando(false)}
        />
      )}

      {/* Estado vacío */}
      {!cargando && anuncios.length === 0 && !mostrando && (
        <div className="card flex flex-col items-center justify-center py-16 text-center gap-4">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
            <ImageOff size={28} className="text-gray-300" />
          </div>
          <div>
            <p className="font-semibold text-gray-500">Sin anuncios publicados</p>
            <p className="text-sm text-gray-400 mt-0.5">
              Crea uno y aparecerá automáticamente en el dashboard de los apoderados
            </p>
          </div>
          <button onClick={() => setMostrando(true)} className="btn-primary flex items-center gap-2">
            <ImagePlus size={15} /> Crear primer anuncio
          </button>
        </div>
      )}

      {/* Skeleton */}
      {cargando && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map(i => (
            <div key={i} className="card p-0 overflow-hidden animate-pulse">
              <div className="bg-gray-100" style={{ aspectRatio: '16/7' }} />
              <div className="p-4 space-y-2">
                <div className="h-3 bg-gray-100 rounded w-2/3" />
                <div className="h-2.5 bg-gray-100 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Anuncios activos */}
      {!cargando && activos.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-gray-700">Activos</h2>
            <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              {activos.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {activos.map(a => (
              <CardAnuncio key={a.id} anuncio={a} onToggle={toggleAnuncio} onEliminar={eliminarAnuncio} />
            ))}
          </div>
        </div>
      )}

      {/* Anuncios pausados/expirados */}
      {!cargando && inactivos.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-400">Pausados / Expirados</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {inactivos.map(a => (
              <CardAnuncio key={a.id} anuncio={a} onToggle={toggleAnuncio} onEliminar={eliminarAnuncio} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
