/**
 * Haptic feedback — usa Web Vibration API (soportada en Android WebView).
 * En iOS WebView y desktop no hace nada (silencioso).
 */
const vibrar = (pattern) => {
  try { navigator?.vibrate?.(pattern) } catch (_) {}
}

/** Tap ligero — para toques simples, navegación */
export const hapticLight = () => vibrar(25)

/** Tap medio — para confirmaciones, selecciones */
export const hapticMedium = () => vibrar(50)

/** Éxito — doble pulso corto (escaneo QR correcto, guardado OK) */
export const hapticSuccess = () => vibrar([40, 60, 40])

/** Error — pulso largo (escaneo fallido, error de validación) */
export const hapticError = () => vibrar(120)

/** Advertencia — pulso medio-largo */
export const hapticWarning = () => vibrar(80)
