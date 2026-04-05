/**
 * Status bar: fondo marino + íconos blancos
 */
export async function setStatusBarDark() {
  if (!window.Capacitor?.isNativePlatform?.()) return
  try {
    const { SystemBars } = await import(/* @vite-ignore */ '@capacitor/core')
    await SystemBars.setBackgroundColor({ color: '#0a1f3d' })
    await SystemBars.setStyle({ style: 'LIGHT' })
  } catch (_) {}
}
