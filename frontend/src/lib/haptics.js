/**
 * Haptic feedback — nativo con @capacitor/haptics en APK,
 * fallback a Web Vibration API en navegador.
 */
const isNative = () => window.Capacitor?.isNativePlatform?.() === true

const vibrar = (pattern) => {
  try { navigator?.vibrate?.(pattern) } catch (_) {}
}

async function nativeImpact(style) {
  try {
    const { Haptics } = await import('@capacitor/haptics')
    await Haptics.impact({ style })
  } catch (_) {}
}

async function nativeNotification(type) {
  try {
    const { Haptics } = await import('@capacitor/haptics')
    await Haptics.notification({ type })
  } catch (_) {}
}

/** Tap ligero — para toques simples, navegación */
export const hapticLight = () => {
  if (isNative()) { nativeImpact('LIGHT'); return }
  vibrar(25)
}

/** Tap medio — para confirmaciones, selecciones */
export const hapticMedium = () => {
  if (isNative()) { nativeImpact('MEDIUM'); return }
  vibrar(50)
}

/** Éxito — doble pulso corto (escaneo QR correcto, guardado OK) */
export const hapticSuccess = () => {
  if (isNative()) { nativeNotification('SUCCESS'); return }
  vibrar([40, 60, 40])
}

/** Error — pulso largo (escaneo fallido, error de validación) */
export const hapticError = () => {
  if (isNative()) { nativeNotification('ERROR'); return }
  vibrar(120)
}

/** Advertencia — pulso medio-largo */
export const hapticWarning = () => {
  if (isNative()) { nativeNotification('WARNING'); return }
  vibrar(80)
}
