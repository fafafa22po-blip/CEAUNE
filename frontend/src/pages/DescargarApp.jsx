import { Smartphone, Zap, Bell, QrCode, WifiOff, Download, CheckCircle2 } from 'lucide-react'

const APK_URL = import.meta.env.VITE_APK_URL || null

const BENEFICIOS = [
  { icon: Bell,      titulo: 'Notificaciones push',  desc: 'Alertas al instante sin abrir el navegador' },
  { icon: Zap,       titulo: 'Acceso rápido',         desc: 'Un toque desde tu pantalla de inicio' },
  { icon: QrCode,    titulo: 'Escaneo QR nativo',     desc: 'Cámara más fluida para escanear carnets' },
  { icon: WifiOff,   titulo: 'Sin señal estable',     desc: 'Funciona aunque tu red sea lenta' },
]

const COMPARATIVA = [
  { feature: 'Notificaciones push',    app: true,  web: false },
  { feature: 'Acceso desde inicio',    app: true,  web: false },
  { feature: 'Sin abrir navegador',    app: true,  web: false },
  { feature: 'Escaneo QR optimizado',  app: true,  web: true  },
  { feature: 'Compatible con Android', app: true,  web: true  },
]

export default function DescargarApp() {
  const esNativo = window.Capacitor?.isNativePlatform?.() === true

  if (esNativo) {
    return (
      <div className="max-w-sm mx-auto py-16 px-4 text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 size={32} className="text-emerald-600" />
        </div>
        <h2 className="text-xl font-black text-marino mb-2">Ya tienes la app instalada</h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          Estás usando la aplicación nativa CEAUNE. Tienes acceso a todas las funciones, incluyendo notificaciones push.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto py-4 px-1 space-y-5">

      {/* Hero */}
      <div className="text-center">
        <div className="w-16 h-16 bg-marino rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <Smartphone size={30} className="text-dorado" />
        </div>
        <h1 className="text-2xl font-black text-marino">Descarga la App CEAUNE</h1>
        <p className="text-gray-500 text-sm mt-2 leading-relaxed max-w-xs mx-auto">
          La experiencia completa en tu Android. Más rápido, con notificaciones en tiempo real.
        </p>
      </div>

      {/* Beneficios */}
      <div className="grid grid-cols-2 gap-3">
        {BENEFICIOS.map(({ icon: Icon, titulo, desc }) => (
          <div key={titulo} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
              style={{ background: 'rgba(10,31,61,0.07)' }}
            >
              <Icon size={18} className="text-marino" />
            </div>
            <p className="font-bold text-sm text-marino leading-tight">{titulo}</p>
            <p className="text-xs text-gray-400 mt-1 leading-snug">{desc}</p>
          </div>
        ))}
      </div>

      {/* Comparativa */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-50">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">App vs Navegador web</p>
        </div>

        {/* Cabecera columnas */}
        <div className="flex items-center px-4 py-2 border-b border-gray-50">
          <span className="flex-1" />
          <div className="flex gap-6">
            <span className="w-12 text-center text-[10px] font-bold text-marino uppercase tracking-wide">App</span>
            <span className="w-12 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wide">Web</span>
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {COMPARATIVA.map(({ feature, app, web }) => (
            <div key={feature} className="flex items-center px-4 py-3">
              <span className="flex-1 text-sm text-gray-600">{feature}</span>
              <div className="flex gap-6">
                <div className="w-12 flex justify-center">
                  {app
                    ? <CheckCircle2 size={18} className="text-emerald-500" />
                    : <span className="text-gray-300 text-lg leading-none">—</span>
                  }
                </div>
                <div className="w-12 flex justify-center">
                  {web
                    ? <CheckCircle2 size={18} className="text-emerald-500" />
                    : <span className="text-gray-300 text-lg leading-none">—</span>
                  }
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA descarga */}
      {APK_URL ? (
        <a
          href={APK_URL}
          download
          className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl font-bold text-sm shadow-md active:scale-[0.98] transition-transform"
          style={{ background: '#0a1f3d', color: '#c9a227' }}
        >
          <Download size={20} />
          Descargar APK · Android
        </a>
      ) : (
        <div
          className="text-center py-4 px-4 rounded-2xl"
          style={{ background: 'rgba(201,162,39,0.08)', border: '1px solid rgba(201,162,39,0.2)' }}
        >
          <p className="text-sm font-bold" style={{ color: '#8a6d1a' }}>APK disponible próximamente</p>
          <p className="text-xs mt-1" style={{ color: '#a07d2a' }}>
            Solicita el archivo de instalación al administrador del sistema
          </p>
        </div>
      )}

      <p className="text-center text-[10px] text-gray-300 pb-2">
        Solo disponible para Android · Versión mínima: Android 7.0
      </p>
    </div>
  )
}
