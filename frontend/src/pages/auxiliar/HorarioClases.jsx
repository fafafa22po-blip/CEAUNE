import { useState, useRef } from 'react'
import { GraduationCap, Upload, Trash2, FileText, Image, ExternalLink, Search } from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { obtenerUsuario } from '../../lib/auth'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const ROL_TO_NIVEL = { 'i-auxiliar': 'inicial', 'p-auxiliar': 'primaria', 's-auxiliar': 'secundaria' }
const NIVEL_LABEL  = { inicial: 'Inicial', primaria: 'Primaria', secundaria: 'Secundaria' }

import { GRADOS_POR_NIVEL, getSecciones, formatGrado } from '../../lib/nivelAcademico'

const TIPOS_ACEPTADOS = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp']
const MAX_MB = 8

function esImagen(nombre) {
  return /\.(png|jpe?g|webp)$/i.test(nombre || '')
}

export default function AuxiliarHorarioClases() {
  const usuario = obtenerUsuario()
  const nivel   = ROL_TO_NIVEL[usuario?.rol] || 'primaria'
  const anio    = new Date().getFullYear()

  const gradosNivel = GRADOS_POR_NIVEL[nivel] || []
  const [grado,      setGrado]     = useState(gradosNivel[0] || '')
  const [seccion,    setSeccion]   = useState(getSecciones(nivel, gradosNivel[0] || '')[0] || '')
  const [archivo,    setArchivo]   = useState(null)
  const [cargado,    setCargado]   = useState(false)
  const [buscando,   setBuscando]  = useState(false)
  const [subiendo,   setSubiendo]  = useState(false)
  const [eliminando, setEliminando] = useState(false)

  const inputRef = useRef(null)

  const buscar = async () => {
    setBuscando(true)
    setCargado(false)
    setArchivo(null)
    try {
      const r = await api.get('/admin/horario-clases', {
        params: { nivel, grado, seccion, anio },
      })
      setArchivo(r.data || null)
      setCargado(true)
    } catch {
      toast.error('Error al consultar el horario')
    } finally {
      setBuscando(false)
    }
  }

  const handleArchivo = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!TIPOS_ACEPTADOS.includes(file.type)) {
      toast.error('Solo se aceptan PDF, PNG o JPG')
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`El archivo supera los ${MAX_MB} MB`)
      return
    }

    setSubiendo(true)
    const fd = new FormData()
    fd.append('archivo', file)
    try {
      await api.post('/admin/horario-clases/subir', fd, {
        params: { nivel, grado, seccion, anio },
      })
      toast.success('Horario subido correctamente')
      await buscar()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al subir el archivo')
    } finally {
      setSubiendo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const eliminar = async () => {
    if (!archivo) return
    setEliminando(true)
    try {
      await api.delete(`/admin/horario-clases/${archivo.id}`)
      toast.success('Horario eliminado')
      setArchivo(null)
    } catch {
      toast.error('Error al eliminar')
    } finally {
      setEliminando(false)
    }
  }

  const etiquetaAula = `${NIVEL_LABEL[nivel]} ${grado}° ${seccion}`

  return (
    <div className="max-w-2xl space-y-8">

      <div>
        <h1 className="text-xl font-bold text-marino flex items-center gap-2">
          <GraduationCap size={20} className="text-gray-400" />
          Horario de clases — {NIVEL_LABEL[nivel]}
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Sube el horario semanal de cada aula como PDF o imagen.
          Los apoderados lo verán directamente en su app.
        </p>
      </div>

      {/* Selector de aula */}
      <section className="card space-y-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Seleccionar aula</p>

        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {nivel === 'inicial' ? 'Edad' : 'Grado'}
            </label>
            <select
              className="input"
              value={grado}
              onChange={e => {
                setGrado(e.target.value)
                setSeccion(getSecciones(nivel, e.target.value)[0] || '')
                setCargado(false); setArchivo(null)
              }}
            >
              {GRADOS_POR_NIVEL[nivel].map(g => (
                <option key={g} value={g}>{formatGrado(nivel, g)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {nivel === 'inicial' ? 'Aula' : 'Sección'}
            </label>
            <select
              className="input"
              value={seccion}
              onChange={e => { setSeccion(e.target.value); setCargado(false); setArchivo(null) }}
            >
              {getSecciones(nivel, grado).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <button
            onClick={buscar}
            disabled={buscando}
            className="btn-primary flex items-center gap-2"
          >
            {buscando
              ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              : <Search size={14} />}
            {buscando ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </section>

      {/* Resultado */}
      {cargado && (
        <section className="space-y-4">
          <h2 className="text-base font-bold text-gray-700">{etiquetaAula}</h2>

          {archivo ? (
            <div className="card space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  {esImagen(archivo.archivo_nombre)
                    ? <Image size={22} className="text-blue-400" />
                    : <FileText size={22} className="text-red-400" />}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">
                    {archivo.archivo_nombre}
                  </p>
                  {archivo.created_at && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Subido el{' '}
                      {format(parseISO(archivo.created_at), "d 'de' MMMM yyyy", { locale: es })}
                    </p>
                  )}
                </div>
              </div>

              {esImagen(archivo.archivo_nombre) && (
                <div className="rounded-xl overflow-hidden border border-gray-100">
                  <img
                    src={archivo.archivo_url}
                    alt="Horario"
                    className="w-full object-contain max-h-96"
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href={archivo.archivo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary flex items-center gap-2 text-sm"
                >
                  <ExternalLink size={14} />
                  Ver archivo
                </a>

                <label className="btn-secondary flex items-center gap-2 text-sm cursor-pointer">
                  {subiendo
                    ? <span className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full" />
                    : <Upload size={14} />}
                  {subiendo ? 'Subiendo...' : 'Reemplazar'}
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={handleArchivo}
                    disabled={subiendo}
                  />
                </label>

                <button
                  onClick={eliminar}
                  disabled={eliminando}
                  className="btn-danger flex items-center gap-2 text-sm"
                >
                  {eliminando
                    ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    : <Trash2 size={14} />}
                  {eliminando ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          ) : (
            <label
              className={`block card border-2 border-dashed cursor-pointer transition-colors text-center py-12 ${
                subiendo
                  ? 'border-dorado/60 bg-amber-50/30'
                  : 'border-gray-200 hover:border-dorado/50 hover:bg-amber-50/20'
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={handleArchivo}
                disabled={subiendo}
              />

              {subiendo ? (
                <div className="flex flex-col items-center gap-3">
                  <span className="animate-spin w-8 h-8 border-3 border-dorado border-t-transparent rounded-full" />
                  <p className="text-sm font-medium text-gray-600">Subiendo archivo...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <Upload size={24} className="text-gray-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700 text-sm">
                      Sube el horario de {etiquetaAula}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      PDF, PNG o JPG · Máx {MAX_MB} MB
                    </p>
                  </div>
                  <span className="btn-primary text-sm px-5">Seleccionar archivo</span>
                </div>
              )}
            </label>
          )}
        </section>
      )}
    </div>
  )
}
