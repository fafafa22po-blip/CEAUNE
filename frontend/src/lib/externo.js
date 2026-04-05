import { registerPlugin } from '@capacitor/core'

const ExternalLink = window.Capacitor?.isNativePlatform?.()
  ? registerPlugin('ExternalLink')
  : null

/**
 * Abre una URL externamente usando el plugin nativo ExternalLink.
 * - En APK: Intent directo de Android (startActivity + ACTION_VIEW)
 * - En navegador web: window.open normal
 */
export async function abrirExterno(url) {
  if (ExternalLink) {
    try {
      await ExternalLink.open({ url })
    } catch (_) {
      window.open(url, '_blank')
    }
  } else {
    window.open(url, '_blank')
  }
}

/**
 * Abre WhatsApp con un contacto directamente.
 * - En APK: whatsapp://send via Intent nativo → WhatsApp se abre instantáneo
 * - En navegador web: https://wa.me → redirect estándar
 * @param {string} telefono — número sin código de país (se añade +51 Perú)
 * @param {string} [mensaje] — texto pre-escrito (opcional)
 */
export async function abrirWhatsApp(telefono, mensaje = '') {
  const num = `51${String(telefono).replace(/\D/g, '')}`
  const texto = mensaje ? encodeURIComponent(mensaje) : ''

  if (ExternalLink) {
    try {
      await ExternalLink.open({ url: `whatsapp://send?phone=${num}${texto ? `&text=${texto}` : ''}` })
    } catch (_) {
      window.open(`https://wa.me/${num}${texto ? `?text=${texto}` : ''}`, '_blank')
    }
  } else {
    window.open(`https://wa.me/${num}${texto ? `?text=${texto}` : ''}`, '_blank')
  }
}
