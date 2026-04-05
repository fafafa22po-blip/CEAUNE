import { useState, useEffect } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'

export default function SinConexion({ children }) {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const onOnline  = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  if (online) return children

  return (
    <div className="fixed inset-0 z-[999] bg-marino flex flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center">
        <WifiOff size={36} className="text-white/50" />
      </div>
      <div>
        <p className="text-white font-bold text-xl">Sin conexión</p>
        <p className="text-white/50 text-sm mt-1.5 leading-snug">
          Revisa tu red WiFi o datos móviles<br />e intenta de nuevo
        </p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-2 px-6 py-3 bg-dorado rounded-2xl text-white font-semibold text-sm active:scale-[0.96] transition-transform select-none"
      >
        <RefreshCw size={15} />
        Reintentar
      </button>
    </div>
  )
}
