import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

// Cambia este número cada vez que generes una nueva APK
const APP_VERSION = "1.0"

export default function ActualizadorApp() {
  const [actualizacion, setActualizacion] = useState(null)

  useEffect(() => {
    fetch('/api/version')
      .then((r) => r.json())
      .then((data) => {
        const minima = parseFloat(data.version_minima)
        const actual = parseFloat(APP_VERSION)
        if (actual < minima) setActualizacion(data)
      })
      .catch(() => {})  // Sin conexión: no bloquear al usuario
  }, [])

  if (!actualizacion) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(10,31,61,0.97)' }}>
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
        <div className="w-20 h-20 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: '#1a4590' }}>
          <span className="font-bold text-2xl" style={{ color: '#ffba08' }}>CE</span>
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: '#1a4590' }}>
          Actualización requerida
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          {actualizacion.mensaje}
        </p>
        <a
          href={actualizacion.url_apk}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-white"
          style={{ background: '#1a4590' }}
        >
          <Download size={18} />
          Descargar actualización
        </a>
        <p className="text-xs text-gray-400 mt-4">
          Versión instalada: {APP_VERSION} &nbsp;·&nbsp; Requerida: {actualizacion.version_minima}
        </p>
      </div>
    </div>
  )
}
