import { Capacitor, registerPlugin } from '@capacitor/core'

const DocumentScannerNative = registerPlugin('DocumentScanner')

/**
 * Abre el escáner ML Kit en nativo o el file picker en web.
 * Resuelve con { file: File } listo para usar en FormData.
 * Lanza error con code "CANCELLED" si el usuario cancela.
 * Si el plugin nativo no está disponible (APK sin recompilar), cae al file picker.
 */
export async function scanDocument() {
  if (!Capacitor.isNativePlatform()) {
    return webFilePicker()
  }

  try {
    const result = await DocumentScannerNative.scan()
    const file = base64ToFile(result.base64, result.name, result.mimeType)
    return { file, pageCount: result.pageCount }
  } catch (err) {
    if (err?.code === 'CANCELLED') throw err
    // Plugin no disponible en esta versión del APK → fallback al picker
    return webFilePicker()
  }
}

function webFilePicker() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*,application/pdf'
    input.onchange = (e) => {
      const file = e.target.files?.[0]
      if (file) resolve({ file })
      else reject(Object.assign(new Error('Sin archivo'), { code: 'CANCELLED' }))
    }
    // Si el usuario cierra sin elegir, onchange no se dispara en todos los navegadores
    window.addEventListener('focus', function onFocus() {
      window.removeEventListener('focus', onFocus)
      setTimeout(() => {
        if (!input.files?.length) {
          reject(Object.assign(new Error('Cancelado'), { code: 'CANCELLED' }))
        }
      }, 500)
    }, { once: true })
    input.click()
  })
}

function base64ToFile(base64, name, mimeType) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new File([bytes], name, { type: mimeType })
}

export const esNativo = Capacitor.isNativePlatform()
