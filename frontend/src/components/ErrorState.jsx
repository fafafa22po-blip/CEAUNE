import { WifiOff, ServerCrash, AlertCircle, RefreshCw, FolderOpen } from 'lucide-react'

const TIPOS = {
  red: {
    Icon:    WifiOff,
    titulo:  'Sin conexión',
    mensaje: 'Verifica tu conexión a internet e intenta de nuevo.',
    color:   'bg-orange-50 text-orange-400',
  },
  servidor: {
    Icon:    ServerCrash,
    titulo:  'Error del servidor',
    mensaje: 'Ocurrió un problema al obtener los datos. Intenta más tarde.',
    color:   'bg-red-50 text-red-400',
  },
  vacio: {
    Icon:    FolderOpen,
    titulo:  'Sin resultados',
    mensaje: 'No hay datos para mostrar por el momento.',
    color:   'bg-gray-100 text-gray-400',
  },
  generico: {
    Icon:    AlertCircle,
    titulo:  'Algo salió mal',
    mensaje: 'Ocurrió un error inesperado. Por favor intenta de nuevo.',
    color:   'bg-red-50 text-red-400',
  },
}

/**
 * ErrorState — estado visual para errores y listas vacías.
 *
 * @param {'red'|'servidor'|'vacio'|'generico'} tipo
 * @param {string}   titulo       — sobreescribe el título por defecto
 * @param {string}   mensaje      — sobreescribe el mensaje por defecto
 * @param {Function} onReintentar — muestra botón "Reintentar" si se pasa
 * @param {string}   className    — clases extra para el contenedor
 *
 * Uso:
 *   <ErrorState tipo="red" onReintentar={cargar} />
 *   <ErrorState tipo="vacio" titulo="Sin comunicados" mensaje="No tienes comunicados nuevos." />
 */
export default function ErrorState({ tipo = 'generico', titulo, mensaje, onReintentar, className = '' }) {
  const cfg  = TIPOS[tipo] ?? TIPOS.generico
  const Icon = cfg.Icon

  return (
    <div className={`flex flex-col items-center justify-center py-14 px-6 text-center animate-fade-up ${className}`}>
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${cfg.color}`}>
        <Icon size={28} strokeWidth={1.8} />
      </div>
      <h3 className="text-base font-bold text-gray-800 mb-1.5">
        {titulo ?? cfg.titulo}
      </h3>
      <p className="text-sm text-gray-400 leading-relaxed max-w-xs mb-6">
        {mensaje ?? cfg.mensaje}
      </p>
      {onReintentar && (
        <button onClick={onReintentar} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={15} />
          Reintentar
        </button>
      )}
    </div>
  )
}
