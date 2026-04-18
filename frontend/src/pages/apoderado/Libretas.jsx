import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BookOpen, Download, ExternalLink, Loader2, FileText,
} from 'lucide-react'
import api from '../../lib/api'
import { QK } from '../../lib/queryKeys'
import { useHijo } from '../../context/HijoContext'

const BIMESTRES = [1, 2, 3, 4]

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

export default function Libretas() {
  const anio = new Date().getFullYear()
  const { hijoActivo, cargando: cargandoHijos } = useHijo()
  const [bimestre, setBimestre] = useState(1)

  const { data: libretas = [], isLoading } = useQuery({
    queryKey: QK.apoderadoLibretas(hijoActivo?.id, anio),
    queryFn:  () =>
      api.get(`/apoderado/hijo/${hijoActivo.id}/libretas`, { params: { anio } })
         .then(r => r.data),
    enabled:   !!hijoActivo?.id,
    staleTime: 5 * 60_000,
  })

  const libretaActual = libretas.find(l => l.bimestre === bimestre)
  const cargando = cargandoHijos || isLoading

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      <div>
        <h1 className="text-lg font-bold text-marino">Libretas de notas</h1>
        {hijoActivo && (
          <p className="text-sm text-gray-400 mt-0.5">
            {hijoActivo.nombre} {hijoActivo.apellido} · {anio}
          </p>
        )}
      </div>

      {/* Bimestre tabs con indicador de disponibilidad */}
      <div className="flex gap-2" data-tour="libretas-bimestres">
        {BIMESTRES.map(b => {
          const tiene = libretas.some(l => l.bimestre === b)
          return (
            <button
              key={b}
              onClick={() => setBimestre(b)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all relative ${
                bimestre === b
                  ? 'bg-marino text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              B{b}
              {tiene && (
                <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
                  bimestre === b ? 'bg-white/60' : 'bg-green-400'
                }`} />
              )}
            </button>
          )
        })}
      </div>

      {cargando ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="text-marino animate-spin" />
        </div>
      ) : libretaActual ? (
        <div className="space-y-3">

          {/* Info + Descargar */}
          <div className="card py-3.5 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
              <FileText size={20} className="text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">
                {libretaActual.archivo_nombre}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Subida el{' '}
                {new Date(libretaActual.subido_en).toLocaleDateString('es-PE', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </p>
            </div>
            <a
              href={urlDescarga(libretaActual.archivo_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-dorado hover:bg-yellow-600 active:bg-yellow-700 text-white text-xs font-semibold transition-colors"
            >
              <Download size={13} />
              Descargar
            </a>
          </div>

          {/* Visor */}
          <div
            className="card p-0 overflow-hidden"
            style={{ height: 'calc(100vh - 22rem)', minHeight: '380px' }}
          >
            <iframe
              src={urlPreview(libretaActual.archivo_url)}
              className="w-full h-full border-0"
              title={`Libreta Bimestre ${bimestre}`}
              allow="autoplay"
            />
          </div>

          {/* Abrir completo */}
          <a
            href={libretaActual.archivo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-600 transition-colors"
          >
            <ExternalLink size={14} />
            Abrir en pantalla completa
          </a>
        </div>
      ) : (
        <div className="card flex flex-col items-center justify-center py-16 text-center gap-4">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
            <BookOpen size={28} className="text-gray-300" />
          </div>
          <div>
            <p className="font-semibold text-gray-600">Libreta no disponible aún</p>
            <p className="text-xs text-gray-400 mt-1.5 max-w-[240px] leading-relaxed">
              La libreta del Bimestre {bimestre}
              {hijoActivo ? ` de ${hijoActivo.nombre}` : ''} aún no ha sido subida por el tutor.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
