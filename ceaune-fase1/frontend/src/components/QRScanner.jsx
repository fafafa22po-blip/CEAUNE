import { useRef, useEffect, useCallback, useState } from 'react'
import Webcam from 'react-webcam'
import jsQR from 'jsqr'

const DEBOUNCE_MS = 2500 // ms entre detecciones del mismo QR

export default function QRScanner({ onResult, active = true }) {
  const webcamRef  = useRef(null)
  const canvasRef  = useRef(null)
  const rafRef     = useRef(null)
  const lastScan   = useRef('')
  const lastScanAt = useRef(0)

  const [camError, setCamError] = useState(null)
  const [detected, setDetected] = useState(false)

  const scan = useCallback(() => {
    const video = webcamRef.current?.video
    const canvas = canvasRef.current

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      canvas.width  = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      })

      if (code?.data) {
        const now = Date.now()
        const isDuplicate =
          code.data === lastScan.current && now - lastScanAt.current < DEBOUNCE_MS

        if (!isDuplicate) {
          lastScan.current   = code.data
          lastScanAt.current = now
          setDetected(true)
          setTimeout(() => setDetected(false), 600)
          onResult(code.data)
        }
      }
    }

    rafRef.current = requestAnimationFrame(scan)
  }, [onResult])

  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(rafRef.current)
      return
    }
    rafRef.current = requestAnimationFrame(scan)
    return () => cancelAnimationFrame(rafRef.current)
  }, [active, scan])

  if (camError) {
    return (
      <div className="flex flex-col items-center justify-center bg-gray-100 rounded-xl p-8 text-center gap-3 h-64">
        <span className="text-4xl">📵</span>
        <p className="text-gray-600 font-medium">Sin acceso a la cámara</p>
        <p className="text-sm text-gray-400">{camError}</p>
        <p className="text-xs text-gray-400">Usa la pestaña de ingreso manual por DNI</p>
      </div>
    )
  }

  return (
    <div className="relative rounded-xl overflow-hidden bg-black">
      <Webcam
        ref={webcamRef}
        audio={false}
        screenshotFormat="image/jpeg"
        videoConstraints={{ facingMode: 'environment', width: 640, height: 480 }}
        onUserMediaError={(e) => setCamError(e?.message || 'Permiso denegado')}
        className="w-full rounded-xl"
        style={{ display: 'block' }}
      />

      {/* Overlay con marco de escaneo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className={`w-52 h-52 relative transition-all duration-300 ${detected ? 'scale-105' : ''}`}>
          {/* Esquinas del marco */}
          {[
            'top-0 left-0 border-t-4 border-l-4 rounded-tl-lg',
            'top-0 right-0 border-t-4 border-r-4 rounded-tr-lg',
            'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-lg',
            'bottom-0 right-0 border-b-4 border-r-4 rounded-br-lg',
          ].map((cls, i) => (
            <div
              key={i}
              className={`absolute w-8 h-8 ${cls} transition-colors duration-300 ${
                detected ? 'border-green-400' : 'border-ceaune-gold'
              }`}
            />
          ))}
          {/* Línea de escaneo animada */}
          {!detected && (
            <div className="absolute inset-x-2 top-1/2 h-0.5 bg-ceaune-gold/70 animate-pulse" />
          )}
        </div>
      </div>

      {/* Flash verde al detectar */}
      {detected && (
        <div className="absolute inset-0 bg-green-400/20 rounded-xl animate-pulse pointer-events-none" />
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
