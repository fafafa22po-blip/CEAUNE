/**
 * Status bar: fondo marino + íconos blancos
 */
export async function setStatusBarDark() {
  if (!window.Capacitor?.isNativePlatform?.()) return
  try {
    const { StatusBar } = await import('@capacitor/status-bar')
    await StatusBar.setBackgroundColor({ color: '#0a1f3d' })
    await StatusBar.setStyle({ style: 'LIGHT' })
  } catch (_) {}
}
