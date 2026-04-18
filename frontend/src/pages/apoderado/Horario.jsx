import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GraduationCap, FileText, Image, Download, ExternalLink, Loader2 } from 'lucide-react'
import api from '../../lib/api'
import { formatGradoSeccion } from '../../lib/nivelAcademico'
import { QK } from '../../lib/queryKeys'
import { useHijo } from '../../context/HijoContext'

const NIVEL_LABEL = { inicial: 'Inicial', primaria: 'Primaria', secundaria: 'Secundaria' }
const NIVEL_COLOR = {
  inicial:    'bg-emerald-100 text-emerald-700',
  primaria:   'bg-blue-100 text-blue-700',
  secundaria: 'bg-amber-100 text-amber-700',
}

function esImagen(nombre) {
  return /\.(png|jpe?g|webp)$/i.test(nombre || '')
}

// Extrae el file ID de una URL de Google Drive
function extraerDriveId(url) {
  const match = url?.match(/\/d\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

function urlPreview(url) {
  const id = extraerDriveId(url)
  return id ? `https://drive.google.com/file/d/${id}/preview` : url
}

function urlDescarga(url) {
  const id = extraerDriveId(url)
  return id ? `https://drive.google.com/uc?export=download&id=${id}` : url
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonHorario() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="card flex items-center gap-3 py-3.5">
        <div className="w-11 h-11 bg-gray-200 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-gray-200 rounded w-36" />
          <div className="h-3 bg-gray-200 rounded w-24" />
        </div>
        <div className="w-28 h-9 bg-gray-200 rounded-xl" />
      </div>
      <div className="bg-gray-200 rounded-xl" style={{ height: 'calc(100vh - 18rem)', minHeight: '420px' }} />
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function SinHorario({ nombre }) {
  return (
    <div className="card flex flex-col items-center justify-center py-16 text-center gap-4">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
        <GraduationCap size={28} className="text-gray-300" />
      </div>
      <div>
        <p className="font-semibold text-gray-600">Horario no disponible aún</p>
        <p className="text-xs text-gray-400 mt-1.5 max-w-[240px] leading-relaxed">
          Cuando el administrador suba el horario
          {nombre ? ` de ${nombre}` : ''}, aparecerá aquí.
        </p>
      </div>
    </div>
  )
}

// ── Vista del horario ─────────────────────────────────────────────────────────
function VistaHorario({ archivo, hijo }) {
  const [iframeLoading, setIframeLoading] = useState(true)
  const esImg  = esImagen(archivo.archivo_nombre)
  const nivel  = hijo?.nivel || 'primaria'
  const anio   = new Date().getFullYear()

  const fechaActualizada = archivo.created_at
    ? new Date(archivo.created_at).toLocaleDateString('es-PE', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  return (
    <div className="space-y-3">

      {/* ── Info + Descargar ── */}
      <div className="card py-3.5 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
          {esImg
            ? <Image size={20} className="text-blue-400" />
            : <FileText size={20} className="text-red-400" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-800">Horario {anio}</p>
            {hijo && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${NIVEL_COLOR[nivel] ?? 'bg-gray-100 text-gray-600'}`}>
                {NIVEL_LABEL[nivel]} · {formatGradoSeccion(hijo.nivel, hijo.grado, hijo.seccion)}
              </span>
            )}
          </div>
          {fechaActualizada && (
            <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
              Actualizado el {fechaActualizada}
            </p>
          )}
        </div>

        <a
          href={urlDescarga(archivo.archivo_url)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-dorado hover:bg-yellow-600 active:bg-yellow-700 text-white text-xs font-semibold transition-colors"
        >
          <Download size={13} />
          Descargar
        </a>
      </div>

      {/* ── Visor ── */}
      {esImg ? (
        <div className="card p-0 overflow-hidden">
          <img
            src={archivo.archivo_url}
            alt="Horario de clases"
            className="w-full object-contain"
            style={{ touchAction: 'pinch-zoom' }}
          />
        </div>
      ) : (
        <div
          className="card p-0 overflow-hidden relative"
          style={{ height: 'calc(100vh - 18rem)', minHeight: '420px' }}
        >
          {/* Spinner mientras carga el iframe */}
          {iframeLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white z-10">
              <Loader2 size={28} className="text-marino animate-spin" />
              <p className="text-sm text-gray-400">Cargando horario...</p>
            </div>
          )}
          <iframe
            src={urlPreview(archivo.archivo_url)}
            className="w-full h-full border-0"
            title="Horario de clases"
            onLoad={() => setIframeLoading(false)}
            allow="autoplay"
          />
        </div>
      )}

      {/* ── Abrir en pantalla completa (PDF) ── */}
      {!esImg && (
        <a
          href={archivo.archivo_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-600 transition-colors"
        >
          <ExternalLink size={14} />
          Abrir en pantalla completa
        </a>
      )}

    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Horario() {
  const anio = new Date().getFullYear()
  const { hijoActivo, cargando: cargandoHijos } = useHijo()

  const { data: archivo, isLoading: cargandoArchivo } = useQuery({
    queryKey: QK.horarioArchivo(hijoActivo?.id, anio),
    queryFn:  () =>
      api.get(`/apoderado/hijo/${hijoActivo.id}/horario-archivo`, { params: { anio } })
         .then(r => r.data),
    enabled:   !!hijoActivo?.id,
    staleTime: 10 * 60_000,
  })

  const cargando = cargandoHijos || cargandoArchivo

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      <div data-tour="horario-header">
        <h1 className="text-lg font-bold text-marino">Horario de clases</h1>
        {hijoActivo && (
          <p className="text-sm text-gray-400 mt-0.5">
            {hijoActivo.nombre} {hijoActivo.apellido}
          </p>
        )}
      </div>

      {cargando ? (
        <SkeletonHorario />
      ) : archivo ? (
        <VistaHorario archivo={archivo} hijo={hijoActivo} />
      ) : (
        <SinHorario nombre={hijoActivo?.nombre} />
      )}

    </div>
  )
}
