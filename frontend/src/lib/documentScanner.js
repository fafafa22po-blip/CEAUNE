import { Capacitor, registerPlugin } from '@capacitor/core'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'

const DocumentScannerNative = registerPlugin('DocumentScanner')

const COMPRESS_THRESHOLD_MB = 2

/**
 * Abre el escáner ML Kit en nativo o el file picker en web.
 * Resuelve con { file: File } listo para usar en FormData.
 * Lanza error con code "CANCELLED" si el usuario cancela.
 */
export async function scanDocument() {
  if (!Capacitor.isNativePlatform()) {
    return webFilePicker()
  }

  try {
    const result = await DocumentScannerNative.scan()
    const raw  = base64ToFile(result.base64, result.name, result.mimeType)
    const file = await enhanceDocument(raw)
    return { file, pageCount: result.pageCount }
  } catch (err) {
    if (err?.code === 'CANCELLED') throw err
    // Plugin no disponible en esta versión del APK → fallback al picker
    return webFilePicker()
  }
}

/**
 * Abre la cámara nativa y devuelve la foto comprimida como File.
 * Lanza error con code "CANCELLED" si el usuario cancela.
 */
export async function takePhoto() {
  try {
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
    })
    const raw = base64ToFile(
      photo.base64String,
      `foto_${Date.now()}.jpg`,
      'image/jpeg',
    )
    const file = await compressImage(raw)
    return { file }
  } catch (err) {
    const msg = (err?.message ?? '').toLowerCase()
    if (msg.includes('cancel') || msg.includes('no image') || msg.includes('denied')) {
      throw Object.assign(new Error('Cancelado'), { code: 'CANCELLED' })
    }
    throw err
  }
}

/**
 * Mejora automática de documento escaneado:
 * 1. Escala a máx 2048px (velocidad en móvil)
 * 2. Auto-niveles por canal (fondo blanco, texto oscuro)
 * 3. Sharpening (nitidez de bordes del texto)
 * PDFs se devuelven sin cambios.
 */
export async function enhanceDocument(file) {
  if (!file.type.startsWith('image/')) return file

  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)

      // 1. Escalar a máx 2048 para que el procesamiento sea rápido en móvil
      let { width, height } = img
      const maxDim = 2048
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height)
        width  = Math.round(width  * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      const imageData = ctx.getImageData(0, 0, width, height)
      const src = imageData.data
      const pixels = width * height

      // 2. Auto-niveles: histograma por canal, clip 1%-99%
      const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)]
      for (let i = 0; i < src.length; i += 4) {
        hist[0][src[i]]++; hist[1][src[i+1]]++; hist[2][src[i+2]]++
      }
      const clip = pixels * 0.01
      const lut  = [new Uint8Array(256), new Uint8Array(256), new Uint8Array(256)]
      for (let c = 0; c < 3; c++) {
        let low = 0, high = 255, count = 0
        for (let v = 0;   v < 256; v++) { count += hist[c][v]; if (count >= clip) { low  = v; break } }
        count = 0
        for (let v = 255; v >= 0;  v--) { count += hist[c][v]; if (count >= clip) { high = v; break } }
        const range = Math.max(high - low, 1)
        for (let v = 0; v < 256; v++) {
          lut[c][v] = Math.min(255, Math.max(0, Math.round((v - low) / range * 255)))
        }
      }

      const leveled = new Uint8ClampedArray(src.length)
      for (let i = 0; i < src.length; i += 4) {
        leveled[i]   = lut[0][src[i]]
        leveled[i+1] = lut[1][src[i+1]]
        leveled[i+2] = lut[2][src[i+2]]
        leveled[i+3] = src[i+3]
      }

      // 3. Sharpening con kernel 3×3 (0,-1,0 / -1,5,-1 / 0,-1,0)
      const out = new Uint8ClampedArray(leveled.length)
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4
          if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
            out[idx] = leveled[idx]; out[idx+1] = leveled[idx+1]
            out[idx+2] = leveled[idx+2]; out[idx+3] = leveled[idx+3]
            continue
          }
          for (let c = 0; c < 3; c++) {
            const center = leveled[idx + c]
            const n  = leveled[((y-1)*width + x    ) * 4 + c]
            const s  = leveled[((y+1)*width + x    ) * 4 + c]
            const e  = leveled[(y    *width + x + 1) * 4 + c]
            const w  = leveled[(y    *width + x - 1) * 4 + c]
            out[idx+c] = Math.min(255, Math.max(0, 5*center - n - s - e - w))
          }
          out[idx+3] = leveled[idx+3]
        }
      }

      ctx.putImageData(new ImageData(out, width, height), 0, 0)
      canvas.toBlob(
        (blob) => resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })),
        'image/jpeg', 0.92,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

/**
 * Comprime una imagen si supera COMPRESS_THRESHOLD_MB.
 * PDFs y archivos pequeños se devuelven sin cambios.
 */
export async function compressImage(file, maxMB = COMPRESS_THRESHOLD_MB) {
  if (!file.type.startsWith('image/')) return file
  if (file.size <= maxMB * 1024 * 1024) return file

  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      const maxDim = 1920
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height)
        width  = Math.round(width  * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          const name = file.name.replace(/\.[^.]+$/, '.jpg')
          resolve(new File([blob], name, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        0.78,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

function webFilePicker() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type   = 'file'
    input.accept = 'image/*,application/pdf'
    input.onchange = async (e) => {
      const raw = e.target.files?.[0]
      if (!raw) {
        reject(Object.assign(new Error('Sin archivo'), { code: 'CANCELLED' }))
        return
      }
      const file = await compressImage(raw)
      resolve({ file })
    }
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
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], name, { type: mimeType })
}

export const esNativo = Capacitor.isNativePlatform()
