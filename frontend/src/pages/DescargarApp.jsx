import { Download, CheckCircle2, Star, Sparkles } from 'lucide-react'
import mascotaImg from '../assets/mascota.png'

const APK_URL = import.meta.env.VITE_APK_URL || null

const PASOS = [
  { n: '1', texto: 'Toca el botón de descarga' },
  { n: '2', texto: 'Abre el archivo .apk descargado' },
  { n: '3', texto: 'Acepta instalar apps externas' },
  { n: '4', texto: '¡Listo! Abre CEAUNE' },
]

const BENEFICIOS = [
  { emoji: '🔔', titulo: 'Notificaciones al instante', desc: 'Entérate de faltas y comunicados sin abrir el navegador' },
  { emoji: '⚡', titulo: 'Un toque y listo',           desc: 'Acceso directo desde tu pantalla de inicio' },
  { emoji: '📷', titulo: 'Escaneo QR fluido',          desc: 'Cámara nativa, más rápida y precisa' },
  { emoji: '🌐', titulo: 'Funciona sin señal fuerte',  desc: 'Carga rápido aunque tu red sea lenta' },
]

export default function DescargarApp() {
  const esNativo = window.Capacitor?.isNativePlatform?.() === true

  /* ── Ya tiene la app ── */
  if (esNativo) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center">
        {/* Mascota con glow */}
        <div className="relative mb-6">
          <div
            className="absolute inset-0 rounded-full blur-2xl opacity-40 scale-110"
            style={{ background: 'radial-gradient(circle, #c9a227 0%, transparent 70%)' }}
          />
          <img
            src={mascotaImg}
            alt="Mascota CEAUNE"
            className="relative w-40 h-40 object-contain drop-shadow-2xl"
            style={{ animation: 'float 3s ease-in-out infinite' }}
          />
        </div>

        {/* Burbuja */}
        <div className="relative bg-white rounded-3xl px-6 py-4 shadow-lg mb-2 max-w-xs">
          <div
            className="absolute -top-3 left-1/2 -translate-x-1/2 w-0 h-0"
            style={{ borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderBottom: '14px solid white' }}
          />
          <p className="font-black text-marino text-base leading-tight">¡Ya me tienes! 🎉</p>
          <p className="text-gray-500 text-sm mt-1 leading-snug">
            Estás usando la app nativa. Tienes todas las funciones activas, incluyendo notificaciones push.
          </p>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <CheckCircle2 size={18} className="text-emerald-500" />
          <span className="text-sm font-semibold text-emerald-600">App CEAUNE instalada y activa</span>
        </div>

        <style>{`@keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }`}</style>
      </div>
    )
  }

  /* ── Versión web ── */
  return (
    <div className="max-w-md mx-auto pb-8">

      {/* ══ HERO ══════════════════════════════════════════════════════ */}
      <div
        className="relative overflow-hidden rounded-3xl mb-6 px-6 pt-8 pb-6 text-center"
        style={{ background: 'linear-gradient(145deg, #0d2547 0%, #0a1f3d 55%, #071628 100%)' }}
      >
        {/* Círculos decorativos */}
        <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #c9a227, transparent)' }} />
        <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #c9a227, transparent)' }} />
        <div className="absolute top-4 left-6 flex gap-1">
          {[...Array(3)].map((_, i) => (
            <Star key={i} size={10} className="text-dorado opacity-60" fill="currentColor"
              style={{ animation: `twinkle 1.8s ease-in-out ${i * 0.4}s infinite` }} />
          ))}
        </div>

        {/* Mascota flotante */}
        <div className="relative inline-block mb-4">
          <div
            className="absolute inset-0 rounded-full blur-3xl opacity-50"
            style={{ background: 'radial-gradient(circle, #c9a227 0%, transparent 65%)' }}
          />
          <img
            src={mascotaImg}
            alt="Mascota CEAUNE"
            className="relative w-36 h-36 object-contain drop-shadow-2xl mx-auto"
            style={{ animation: 'float 3s ease-in-out infinite' }}
          />
        </div>

        {/* Burbuja de diálogo */}
        <div className="relative bg-white rounded-2xl px-5 py-3.5 mb-5 shadow-xl mx-2">
          <div
            className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-0 h-0"
            style={{ borderLeft: '9px solid transparent', borderRight: '9px solid transparent', borderBottom: '11px solid white' }}
          />
          <p className="font-black text-marino text-sm leading-snug">
            ¡Hola! Soy <span style={{ color: '#c9a227' }}>CEAUNITO</span> 🐿️
          </p>
          <p className="text-gray-500 text-xs mt-1 leading-relaxed">
            Descárgame y nunca te pierdas la asistencia ni los comunicados de tu hijo/a.
          </p>
        </div>

        {/* Título */}
        <h1 className="text-white font-black text-2xl leading-tight mb-1">
          Descarga la <span style={{ color: '#c9a227' }}>App CEAUNE</span>
        </h1>
        <p className="text-white/50 text-xs">Solo para Android · Gratis · Sin publicidad</p>
      </div>

      {/* ══ BENEFICIOS ════════════════════════════════════════════════ */}
      <div className="mb-6 px-1">
        <div className="flex items-center gap-2 mb-3 px-1">
          <Sparkles size={14} className="text-dorado" />
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">¿Por qué la app?</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {BENEFICIOS.map(({ emoji, titulo, desc }, i) => (
            <div
              key={titulo}
              className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"
              style={{ animation: `fadeSlideUp 0.4s ease ${i * 0.08}s both` }}
            >
              <span className="text-2xl mb-2 block">{emoji}</span>
              <p className="font-bold text-xs text-marino leading-tight">{titulo}</p>
              <p className="text-[11px] text-gray-400 mt-1 leading-snug">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ══ WEB vs APP ════════════════════════════════════════════════ */}
      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm mb-6 mx-1">
        <div className="grid grid-cols-2 divide-x divide-gray-100">
          {/* Web */}
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🌐</span>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Navegador</p>
            </div>
            {['Asistencias', 'Comunicados', 'Justificar', 'Horario'].map(f => (
              <div key={f} className="flex items-center gap-2 py-1.5">
                <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
                <span className="text-xs text-gray-500">{f}</span>
              </div>
            ))}
            {['Notificaciones push', 'Acceso rápido'].map(f => (
              <div key={f} className="flex items-center gap-2 py-1.5">
                <span className="text-gray-200 text-base leading-none flex-shrink-0">—</span>
                <span className="text-xs text-gray-300">{f}</span>
              </div>
            ))}
          </div>

          {/* App */}
          <div className="px-4 py-4" style={{ background: 'rgba(10,31,61,0.03)' }}>
            <div className="flex items-center gap-2 mb-3">
              <img src={mascotaImg} alt="" className="w-5 h-5 object-contain" />
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#0a1f3d' }}>App CEAUNE</p>
            </div>
            {['Asistencias', 'Comunicados', 'Justificar', 'Horario', 'Notificaciones push', 'Acceso rápido'].map(f => (
              <div key={f} className="flex items-center gap-2 py-1.5">
                <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
                <span className="text-xs font-medium text-marino">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer de la card */}
        <div
          className="px-4 py-2.5 flex items-center gap-2"
          style={{ background: 'rgba(201,162,39,0.08)', borderTop: '1px solid rgba(201,162,39,0.15)' }}
        >
          <span className="text-sm">🏆</span>
          <p className="text-xs font-semibold" style={{ color: '#8a6d1a' }}>
            La app tiene todo lo del navegador, y más
          </p>
        </div>
      </div>

      {/* ══ PASOS ═════════════════════════════════════════════════════ */}
      <div className="mb-6 px-1">
        <div className="flex items-center gap-2 mb-3 px-1">
          <span className="text-sm">📲</span>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Cómo instalar</p>
        </div>
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          {PASOS.map(({ n, texto }, i) => (
            <div
              key={n}
              className={`flex items-center gap-4 px-5 py-3.5 ${i < PASOS.length - 1 ? 'border-b border-gray-50' : ''}`}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-black text-sm"
                style={{ background: '#0a1f3d', color: '#c9a227' }}
              >
                {n}
              </div>
              <span className="text-sm text-gray-600">{texto}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ══ CTA DESCARGA ══════════════════════════════════════════════ */}
      {APK_URL ? (
        <div className="px-1">
          <a
            href={APK_URL}
            download
            className="relative flex items-center justify-between w-full px-6 py-4 rounded-2xl shadow-lg active:scale-[0.98] transition-transform overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #0d2547 0%, #0a1f3d 100%)' }}
          >
            {/* Glow dorado */}
            <div
              className="absolute inset-0 opacity-20"
              style={{ background: 'radial-gradient(ellipse at 80% 50%, #c9a227 0%, transparent 60%)' }}
            />
            <div className="relative flex items-center gap-3">
              <img src={mascotaImg} alt="" className="w-10 h-10 object-contain drop-shadow" />
              <div>
                <p className="font-black text-white text-sm leading-tight">Descargar App CEAUNE</p>
                <p className="text-white/50 text-[11px] mt-0.5">Android · APK · Gratis</p>
              </div>
            </div>
            <div
              className="relative flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0"
              style={{ background: '#c9a227' }}
            >
              <Download size={18} className="text-white" />
            </div>
          </a>

          <p className="text-center text-[10px] text-gray-300 mt-3">
            Android 7.0 o superior · No requiere Google Play
          </p>
        </div>
      ) : (
        <div className="px-1">
          <div
            className="relative flex items-center gap-4 p-5 rounded-2xl overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #0d2547 0%, #0a1f3d 100%)' }}
          >
            <div
              className="absolute inset-0 opacity-15"
              style={{ background: 'radial-gradient(ellipse at 80% 50%, #c9a227 0%, transparent 60%)' }}
            />
            <img src={mascotaImg} alt="" className="relative w-14 h-14 object-contain drop-shadow-lg flex-shrink-0" />
            <div className="relative">
              <p className="font-black text-white text-sm">¡Próximamente disponible!</p>
              <p className="text-white/50 text-xs mt-1 leading-snug">
                Solicita el APK al administrador del sistema mientras tanto.
              </p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-10px); }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.2); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
