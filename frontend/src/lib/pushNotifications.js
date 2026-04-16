import api from './api'

const FCM_TOKEN_KEY  = 'push_fcm_token'
const ONBOARDING_KEY = 'push_onboarding_done'

/** Llamar cuando el usuario acepta el onboarding de permisos */
export function marcarOnboardingAceptado() {
  localStorage.setItem(ONBOARDING_KEY, '1')
}

let tokenActual = null
let listeners = []
let yaRegistrado = false

let _onPushRecibido = null
let _navigate = null

export function setPushNavigate(fn) { _navigate = fn }

function _urlParaTipo(tipo) {
  if (tipo === 'asistencia' || tipo === 'falta')  return '/apoderado/asistencias'
  if (tipo === 'comunicado')                       return '/apoderado/comunicados'
  if (tipo === 'libreta')                          return '/apoderado/libretas'
  if (tipo === 'observacion')                      return '/apoderado/inicio'
  if (tipo === 'aviso_calendario')                 return '/apoderado/inicio'
  if (tipo === 'aviso_horario')                    return '/apoderado/inicio'
  return null
}

export function onPushRecibido(callback) {
  _onPushRecibido = callback
}

/**
 * Limpia listeners antes de un nuevo login.
 */
export async function resetPush() {
  for (const listener of listeners) {
    try { await listener.remove() } catch (_) {}
  }
  listeners = []
  yaRegistrado = false
}

async function _dbg(paso, detalle = '') {
  try { await api.post('/notificaciones/debug-log', { paso, detalle }) } catch (_) {}
}

/**
 * Registra el dispositivo para push notifications.
 * Solo funciona dentro de la APK nativa (Capacitor).
 * Requiere que el usuario haya completado el onboarding de permisos.
 */
export async function iniciarPush() {
  if (yaRegistrado) { await _dbg('YA_REGISTRADO'); return }

  const Capacitor = window.Capacitor
  if (!Capacitor?.isNativePlatform?.()) { await _dbg('NO_NATIVE'); return }

  // No solicitar permisos hasta que el usuario vea la pantalla de onboarding
  if (localStorage.getItem(ONBOARDING_KEY) !== '1') {
    await _dbg('ESPERANDO_ONBOARDING')
    return
  }

  yaRegistrado = true
  await _dbg('INICIO')

  try {
    // Importar plugins desde sus paquetes (garantiza registro correcto en Capacitor 8)
    const { PushNotifications } = await import('@capacitor/push-notifications')
    const { LocalNotifications } = await import('@capacitor/local-notifications')

    // Solicitar permisos de push
    const permisoPush = await PushNotifications.requestPermissions()
    await _dbg('PERMISO_PUSH', permisoPush.receive)
    if (permisoPush.receive !== 'granted') return

    // Solicitar permisos de notificaciones locales (Android 13+)
    try {
      const permisoLocal = await LocalNotifications.requestPermissions()
      await _dbg('PERMISO_LOCAL', permisoLocal.display)
    } catch (_) {}

    // Crear canal de notificaciones Android (requerido en Android 8+)
    try {
      await LocalNotifications.createChannel({
        id: 'ceaune_push',
        name: 'CEAUNE Notificaciones',
        description: 'Asistencia, comunicados y avisos del colegio',
        importance: 4,  // HIGH
        visibility: 1,  // PUBLIC
        sound: 'default',
        vibration: true,
        lights: true,
        lightColor: '#c9a227',
      })
    } catch (_) {}

    // Token FCM recibido → registrar en backend
    const regListener = await PushNotifications.addListener('registration', async ({ value }) => {
      tokenActual = value
      await _dbg('TOKEN_RECIBIDO', value?.substring(0, 20) || 'vacio')
      await _registrarToken(value)
    })
    listeners.push(regListener)

    // Error de registro FCM
    const errListener = await PushNotifications.addListener('registrationError', async (err) => {
      await _dbg('ERROR_REGISTRO', JSON.stringify(err))
    })
    listeners.push(errListener)

    // Notificación en foreground → mostrar notificación local del sistema
    const fgListener = await PushNotifications.addListener('pushNotificationReceived', async (notif) => {
      await _dbg('FOREGROUND', notif.title || '')

      try {
        await LocalNotifications.schedule({
          notifications: [{
            title: notif.title || 'CEAUNE',
            body: notif.body || '',
            id: Math.floor(Date.now() / 1000) % 2147483647,
            channelId: 'ceaune_push',
            extra: notif.data || {},
          }],
        })
      } catch (e) {
        await _dbg('ERROR_LOCAL_NOTIF', e?.message || '')
      }

      if (_onPushRecibido) _onPushRecibido(notif.data || {})
    })
    listeners.push(fgListener)

    // Tap en notificación → navegar a la sección correspondiente
    const tapListener = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const tipo = action.notification?.data?.tipo
      const url  = _urlParaTipo(tipo)
      if (!url) return
      if (_navigate) {
        _navigate(url, { replace: true })
      } else {
        window.location.href = url
      }
    })
    listeners.push(tapListener)

    await _dbg('ANTES_REGISTER')
    await PushNotifications.register()
    await _dbg('DESPUES_REGISTER')

    // Si el token ya estaba cacheado (FCM no re-dispara registro), re-registrar
    const tokenCache = tokenActual || localStorage.getItem(FCM_TOKEN_KEY)
    if (tokenCache) {
      await _dbg('TOKEN_CACHE', tokenCache.substring(0, 20))
      await _registrarToken(tokenCache)
    }
  } catch (err) {
    await _dbg('ERROR_FATAL', err?.message || String(err))
    yaRegistrado = false
  }
}

/**
 * Abre los ajustes de notificaciones de la app en Android.
 * El bridge de Capacitor intercepta el intent: URL en shouldOverrideUrlLoading
 * y lanza el Activity del sistema con ACTION_APP_NOTIFICATION_SETTINGS.
 * No requiere plugins adicionales ni recompilar la APK.
 */
export function abrirAjustesNotificaciones() {
  if (!window.Capacitor?.isNativePlatform?.()) return
  try {
    window.location.href =
      'intent:#Intent;action=android.settings.APP_NOTIFICATION_SETTINGS;' +
      'S.android.provider.extra.APP_PACKAGE=com.ceaune.app;end'
  } catch (_) {}
}

async function _registrarToken(token) {
  if (!token) return
  try {
    localStorage.setItem(FCM_TOKEN_KEY, token)
    await api.post('/notificaciones/registrar-dispositivo', {
      fcm_token: token,
      plataforma: 'android',
    })
    await _dbg('TOKEN_BACKEND_OK')
  } catch (err) {
    await _dbg('TOKEN_BACKEND_ERROR', err?.response?.data?.detail || err?.message || '')
  }
}
