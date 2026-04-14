import { useRef, useEffect, useState } from 'react'
import QrScanner from 'qr-scanner'
import QrScannerWorkerPath from 'qr-scanner/qr-scanner-worker.min.js?url'
import { RefreshCw, ScanLine } from 'lucide-react'
import { hapticSuccess, hapticError } from '../lib/haptics'

QrScanner.WORKER_PATH = QrScannerWorkerPath

// Detecta si corre en app nativa Capacitor (sin imports que rompan Vite)
const isNative = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = 1050
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.15)
  } catch (_) {}
}

// ── Escáner nativo (ML Kit) ──────────────────────────────────────────────────
function NativeScanner({ onResult, onFallback }) {
  const [escaneando, setEscaneando] = useState(false)
  const [instalando, setInstalando] = useState(false)
  const [error, setError]           = useState(null)

  const escanear = async () => {
    setEscaneando(true)
    setError(null)
    try {
      const { BarcodeScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning')

      // 1. Verificar que el módulo ML Kit esté instalado en el dispositivo.
      //    En el primer uso puede no estar disponible y necesita descargarse.
      const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable()
      if (!available) {
        setInstalando(true)
        setEscaneando(false)
        try {
          await BarcodeScanner.installGoogleBarcodeScannerModule()
          // La instalación es asíncrona en background; avisamos al usuario
          setError('Módulo instalado correctamente. Toca "Escanear QR" para continuar.')
        } catch (_) {
          // Sin Google Play Services o sin conexión → usar escáner web como respaldo
          onFallback?.()
        } finally {
          setInstalando(false)
        }
        return
      }

      // 2. Verificar / solicitar permiso de cámara
      const permisos = await BarcodeScanner.checkPermissions()
      if (permisos.camera !== 'granted') {
        const solicitado = await BarcodeScanner.requestPermissions()
        if (solicitado.camera !== 'granted') {
          setError('Permiso de cámara denegado. Ve a Configuración → Aplicaciones → CEAUNE → Permisos → Cámara.')
          setEscaneando(false)
          return
        }
      }

      // 3. Abrir escáner nativo (pantalla completa, Google ML Kit)
      const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] })

      if (barcodes.length > 0) {
        beep()
        hapticSuccess()
        onResult(barcodes[0].rawValue)
      }
    } catch (err) {
      const msg = err?.message ?? ''

      // El usuario cerró el escáner — no es error
      if (msg === 'scan cancelled') {
        setEscaneando(false)
        return
      }

      hapticError()

      if (msg.toLowerCase().includes('permission')) {
        setError('Sin permiso de cámara. Ve a Configuración → Aplicaciones → CEAUNE → Permisos → Cámara.')
      } else if (
        msg.toLowerCase().includes('module') ||
        msg.toLowerCase().includes('google') ||
        msg.toLowerCase().includes('play')
      ) {
        // ML Kit no disponible en este dispositivo → fallback al escáner web
        onFallback?.()
        return
      } else {
        setError('No se pudo abrir la cámara. Intenta de nuevo.')
      }
    } finally {
      setEscaneando(false)
    }
  }

  const labelBoton = instalando
    ? 'Instalando módulo…'
    : escaneando
      ? 'Abriendo cámara…'
      : 'Escanear QR'

  const esError   = error && !error.startsWith('Módulo instalado')
  const esOk      = error && error.startsWith('Módulo instalado')

  return (
    <div className="flex flex-col items-center justify-center py-8 gap-5">
      {/* Marco QR decorativo */}
      <div className="relative w-44 h-44 flex items-center justify-center">
        <span className="absolute top-0 left-0  w-8 h-8 border-t-[3px] border-l-[3px] border-dorado rounded-tl-md" />
        <span className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-dorado rounded-tr-md" />
        <span className="absolute bottom-0 left-0  w-8 h-8 border-b-[3px] border-l-[3px] border-dorado rounded-bl-md" />
        <span className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-dorado rounded-br-md" />
        <ScanLine size={52} className="text-gray-300" />
      </div>

      <button
        onClick={escanear}
        disabled={escaneando || instalando}
        className="btn-primary px-10 py-3.5 flex items-center gap-2 text-base"
      >
        {(escaneando || instalando)
          ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          : <ScanLine size={18} />
        }
        {labelBoton}
      </button>

      {error && (
        <p className={`text-sm text-center px-4 ${esOk ? 'text-green-600' : esError ? 'text-red-500' : ''}`}>
          {error}
        </p>
      )}

      <p className="text-gray-400 text-xs text-center px-6">
        Toca el botón para abrir la cámara y apunta al fotocheck del alumno
      </p>
    </div>
  )
}

// ── Escáner web (qr-scanner WASM) ────────────────────────────────────────────
function WebScanner({ onResult, activo }) {
  const videoRef    = useRef(null)
  const scannerRef  = useRef(null)
  const flashRef    = useRef(null)
  const scannedRef  = useRef(false)
  const [facingMode, setFacingMode] = useState('environment')
  const [multiCamera, setMultiCamera] = useState(false)

  useEffect(() => {
    if (!activo || !videoRef.current) return

    scannedRef.current = false

    const scanner = new QrScanner(
      videoRef.current,
      result => {
        if (scannedRef.current) return
        scannedRef.current = true
        beep()
        hapticSuccess()
        if (flashRef.current) {
          flashRef.current.style.opacity = '0.5'
          setTimeout(() => { if (flashRef.current) flashRef.current.style.opacity = '0' }, 200)
        }
        onResult(result.data)
      },
      {
        preferredCamera:      'environment',
        maxScansPerSecond:    10,
        highlightScanRegion:  false,
        highlightCodeOutline: false,
      }
    )

    scanner.start().catch(() => {})
    scannerRef.current = scanner

    QrScanner.listCameras(false).then(cams => setMultiCamera(cams.length > 1))

    return () => {
      scanner.destroy()
      scannerRef.current = null
    }
  }, [activo, onResult])

  const toggleCamera = async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
    if (scannerRef.current) {
      try { await scannerRef.current.setCamera(next) } catch (_) {}
    }
  }

  return (
    <div className="relative rounded-xl overflow-hidden bg-black">
      <video ref={videoRef} className="w-full" />

      {multiCamera && (
        <button
          type="button"
          onClick={toggleCamera}
          className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
          title="Cambiar cámara"
        >
          <RefreshCw size={16} />
        </button>
      )}

      <div
        ref={flashRef}
        className="absolute inset-0 bg-green-400 pointer-events-none"
        style={{ opacity: 0, transition: 'opacity 0.15s' }}
      />

      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-3/4 h-3/5 relative">
          <span className="absolute top-0 left-0  w-8 h-8 border-t-[3px] border-l-[3px] border-dorado rounded-tl-md" />
          <span className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-dorado rounded-tr-md" />
          <span className="absolute bottom-0 left-0  w-8 h-8 border-b-[3px] border-l-[3px] border-dorado rounded-bl-md" />
          <span className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-dorado rounded-br-md" />
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
        <div className="w-3/4 h-3/5 relative overflow-hidden">
          <div className="absolute left-0 right-0 h-0.5 bg-dorado/70 shadow-[0_0_6px_2px_rgba(202,160,42,0.5)] animate-scanline" />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent pt-8 pb-3 px-4">
        <p className="text-white/90 text-center text-sm font-medium tracking-wide">
          Acerca el fotocheck a la cámara
        </p>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function QRScanner({ onResult, activo }) {
  // useFallback: true cuando ML Kit falla y caemos al escáner web
  const [useFallback, setUseFallback] = useState(false)

  if (!activo) return null

  // En nativo usamos ML Kit; si falla por módulo/Play Services usamos WebScanner
  if (isNative && !useFallback) {
    return (
      <NativeScanner
        onResult={onResult}
        onFallback={() => setUseFallback(true)}
      />
    )
  }

  return <WebScanner onResult={onResult} activo={activo} />
}
