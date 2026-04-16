import { useState, useEffect, useCallback } from 'react'
import { Bell, Settings } from 'lucide-react'
import { iniciarPush, marcarOnboardingAceptado, abrirAjustesNotificaciones } from '../lib/pushNotifications'

const ONBOARDING_KEY  = 'push_onboarding_done'
const POSPONER_HORAS  = 24  // horas antes de volver a mostrar el aviso tras "Ahora no"

/** Devuelve true si el aviso fue pospuesto hace menos de POSPONER_HORAS */
function estaPospuesto(key) {
  const ts = localStorage.getItem(key)
  if (!ts) return false
  return Date.now() - Number(ts) < POSPONER_HORAS * 60 * 60 * 1000
}

/**
 * Overlay de permisos push con dos modos:
 *  - 'onboarding' : primera vez, explica el valor y pide activar
 *  - 'ajustes'    : permiso denegado por el sistema, guía a Ajustes del dispositivo
 *
 * Fuente de verdad: PushNotifications.checkPermissions() de Android,
 * no localStorage. Así se detecta correctamente cuando:
 *  - El usuario negó el diálogo del sistema (aunque localStorage diga que aceptó)
 *  - El usuario desactivó las notificaciones desde Ajustes de Android
 *  - El usuario las reactivó desde Ajustes → el overlay se cierra solo al volver
 */
export default function OnboardingPermisos() {
  const [vista, setVista]     = useState(null)  // null | 'onboarding' | 'ajustes'
  const [saliendo, setSaliendo] = useState(false)

  const check = useCallback(async () => {
    if (!window.Capacitor?.isNativePlatform?.()) return
    if (!localStorage.getItem('token')) return
    try {
      const { PushNotifications }  = await import('@capacitor/push-notifications')
      const { LocalNotifications } = await import('@capacitor/local-notifications')

      // receive → permiso formal POST_NOTIFICATIONS (Android 13+)
      // display → areNotificationsEnabled() → toggle real en Ajustes del sistema
      // Necesitamos AMBOS en 'granted' para considerar las notificaciones activas.
      const { receive } = await PushNotifications.checkPermissions()
      const { display } = await LocalNotifications.checkPermissions()

      if (receive === 'granted' && display === 'granted') {
        // Todo activo: asegurar gate de iniciarPush abierto y registrar
        if (localStorage.getItem(ONBOARDING_KEY) !== '1') marcarOnboardingAceptado()
        setVista(null)
        iniciarPush().catch(() => {})
        return
      }

      if (receive === 'denied' || display === 'denied') {
        // Permiso denegado O toggle de Ajustes desactivado → guiar al usuario
        if (!estaPospuesto('push_ajustes_pospuesto')) {
          setVista('ajustes')
        }
        return
      }

      // 'prompt' / 'prompt-with-rationale': el sistema puede mostrar el diálogo
      if (!estaPospuesto('push_onboarding_pospuesto')) {
        setVista('onboarding')
      }
    } catch (_) {}
  }, [])

  // Verificar al montar y cuando se dispara el evento de sesión iniciada
  useEffect(() => {
    check()
    window.addEventListener('ceaune:sesion-iniciada', check)
    return () => window.removeEventListener('ceaune:sesion-iniciada', check)
  }, [check])

  // Re-verificar siempre que la app vuelve al frente (desde cualquier estado del overlay)
  useEffect(() => {
    let listener = null
    async function setupResume() {
      try {
        const { App: CapApp } = await import('@capacitor/app')
        listener = await CapApp.addListener('appStateChange', ({ isActive }) => {
          if (isActive) check()
        })
      } catch (_) {}
    }
    setupResume()
    return () => { listener?.remove().catch(() => {}) }
  }, [check])

  if (!vista) return null

  function ocultar() {
    setSaliendo(true)
    setTimeout(() => { setSaliendo(false); setVista(null) }, 300)
  }

  async function activar() {
    marcarOnboardingAceptado()
    ocultar()
    setTimeout(() => iniciarPush().catch(() => {}), 350)
  }

  function posponer() {
    const key = vista === 'ajustes' ? 'push_ajustes_pospuesto' : 'push_onboarding_pospuesto'
    localStorage.setItem(key, String(Date.now()))
    ocultar()
  }

  return (
    <div
      className="fixed inset-0 z-[9998] flex flex-col items-center justify-center px-8"
      style={{
        background: '#0a1f3d',
        opacity: saliendo ? 0 : 1,
        transition: 'opacity 0.3s ease',
      }}
    >
      {/* Círculos decorativos de fondo */}
      <div
        className="absolute -top-20 -right-20 w-64 h-64 rounded-full pointer-events-none"
        style={{ background: '#c9a227', opacity: 0.06 }}
      />
      <div
        className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: '#c9a227', opacity: 0.06 }}
      />

      <div className="relative flex flex-col items-center text-center max-w-xs w-full">
        {vista === 'onboarding'
          ? <VistaOnboarding activar={activar} posponer={posponer} />
          : <VistaAjustes posponer={posponer} />
        }
      </div>

      <style>{`
        @keyframes ceaune-pulse {
          0%, 100% { transform: scale(1);    opacity: 1;   }
          50%       { transform: scale(1.15); opacity: 0.8; }
        }
      `}</style>
    </div>
  )
}

/* ─── Vista 1: Onboarding (primera vez) ─────────────────────────────────── */

function VistaOnboarding({ activar, posponer }) {
  return (
    <>
      <div
        className="w-28 h-28 rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl relative"
        style={{
          background: 'linear-gradient(135deg, rgba(201,162,39,0.18) 0%, rgba(201,162,39,0.08) 100%)',
          border: '1.5px solid rgba(201,162,39,0.35)',
        }}
      >
        <Bell size={52} style={{ color: '#c9a227' }} strokeWidth={1.5} />
        <span
          className="absolute top-[1.6rem] right-[1.6rem] w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-lg"
          style={{ background: '#e74c3c', animation: 'ceaune-pulse 2s ease-in-out infinite' }}
        >3</span>
      </div>

      <h2 className="text-white font-black text-2xl leading-tight mb-3">
        Activa tus<br />notificaciones
      </h2>
      <p className="text-white/55 text-sm leading-relaxed mb-10">
        Te avisamos al instante cuando tu hijo/a llega,
        sale o falta al colegio — sin que tengas que abrir la app.
      </p>

      <div className="w-full space-y-2.5 mb-10">
        {[
          'Asistencia en tiempo real',
          'Comunicados del colegio',
          'Avisos de horarios y eventos',
        ].map((item) => (
          <div
            key={item}
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#c9a227' }} />
            <span className="text-white/70 text-sm text-left">{item}</span>
          </div>
        ))}
      </div>

      <button
        onClick={activar}
        className="w-full py-4 rounded-2xl font-bold text-base mb-3 active:scale-[0.97] transition-transform select-none"
        style={{ background: '#c9a227', color: '#0a1f3d' }}
      >
        Activar ahora
      </button>
      <button
        onClick={posponer}
        className="w-full py-3.5 rounded-2xl font-semibold text-sm active:scale-[0.97] transition-transform select-none"
        style={{
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.18)',
          color: 'rgba(255,255,255,0.45)',
        }}
      >
        Ahora no
      </button>

      <p className="text-white/20 text-xs mt-6 leading-snug">
        Puedes cambiar esto en cualquier momento desde Configuración del dispositivo.
      </p>
    </>
  )
}

/* ─── Vista 2: Ajustes (permiso denegado) ───────────────────────────────── */

function VistaAjustes({ posponer }) {
  return (
    <>
      <div
        className="w-28 h-28 rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl relative"
        style={{
          background: 'linear-gradient(135deg, rgba(201,162,39,0.18) 0%, rgba(201,162,39,0.08) 100%)',
          border: '1.5px solid rgba(201,162,39,0.35)',
        }}
      >
        <Bell size={52} style={{ color: '#c9a227' }} strokeWidth={1.5} />
        {/* Badge de error */}
        <span
          className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-lg"
          style={{ background: '#e74c3c' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </span>
      </div>

      <h2 className="text-white font-black text-2xl leading-tight mb-3">
        Notificaciones<br />desactivadas
      </h2>
      <p className="text-white/55 text-sm leading-relaxed mb-8">
        Para recibir alertas de asistencia y comunicados
        del colegio, activa las notificaciones de CEAUNE.
      </p>

      {/* Pasos */}
      <div
        className="w-full mb-10 rounded-2xl overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {[
          { n: '1', t: 'Toca "Ir a Ajustes"' },
          { n: '2', t: 'Selecciona "Notificaciones"' },
          { n: '3', t: 'Activa las notificaciones de CEAUNE' },
        ].map(({ n, t }, i, arr) => (
          <div
            key={n}
            className="flex items-center gap-3 px-4 py-3"
            style={{
              background: 'rgba(255,255,255,0.04)',
              borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            }}
          >
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
              style={{ background: '#c9a227', color: '#0a1f3d' }}
            >{n}</span>
            <span className="text-white/70 text-sm text-left">{t}</span>
          </div>
        ))}
      </div>

      <button
        onClick={abrirAjustesNotificaciones}
        className="w-full py-4 rounded-2xl font-bold text-base mb-3 active:scale-[0.97] transition-transform select-none flex items-center justify-center gap-2"
        style={{ background: '#c9a227', color: '#0a1f3d' }}
      >
        <Settings size={18} strokeWidth={2.5} />
        Ir a Ajustes
      </button>
      <button
        onClick={posponer}
        className="w-full py-3.5 rounded-2xl font-semibold text-sm active:scale-[0.97] transition-transform select-none"
        style={{
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.18)',
          color: 'rgba(255,255,255,0.45)',
        }}
      >
        Ahora no
      </button>
    </>
  )
}
