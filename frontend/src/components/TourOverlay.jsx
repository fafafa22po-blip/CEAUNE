import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ChevronRight, ChevronLeft } from 'lucide-react'
import { useTour } from '../context/TourContext'

const MARINO  = '#0a1f3d'
const DORADO  = '#c9a227'
const OVERLAY = 'rgba(10, 31, 61, 0.82)'
const PAD     = 10

function useTargetRect(selector, activo, paso) {
  const [rect, setRect] = useState(null)

  useEffect(() => {
    setRect(null)
    if (!activo || !selector) return

    let timer
    let tries = 0

    function find() {
      const el = document.querySelector(selector)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        setTimeout(() => {
          const r = el.getBoundingClientRect()
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
        }, 350)
        return
      }
      tries++
      if (tries < 50) timer = setTimeout(find, 100)
    }

    timer = setTimeout(find, 300)
    return () => clearTimeout(timer)
  }, [selector, activo, paso])

  return rect
}

export default function TourOverlay() {
  const { activo, paso, pasos, siguiente, anterior, cerrar } = useTour()
  const navigate = useNavigate()
  const step = pasos[paso]

  // Navigate when step changes
  useEffect(() => {
    if (!activo || !step?.route) return
    navigate(step.route)
  }, [activo, paso]) // eslint-disable-line

  const rect = useTargetRect(step?.selector, activo, paso)

  if (!activo) return null

  const esCentrado = !step.selector
  const total      = pasos.length

  // ── MODAL CENTRADO (bienvenida / fin) ──────────────────────────────────────
  if (esCentrado) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-5">
        <div
          className="absolute inset-0"
          style={{ background: OVERLAY }}
          onClick={paso === 0 ? undefined : cerrar}
        />
        <div
          className="relative z-10 w-full max-w-sm rounded-3xl p-7 shadow-2xl text-center"
          style={{ background: '#fff' }}
        >
          <button
            onClick={cerrar}
            className="absolute top-4 right-4 text-gray-300 hover:text-gray-500 transition-colors"
          >
            <X size={18} />
          </button>

          <div className="text-5xl mb-3 select-none">{step.icono}</div>

          {/* Puntos de progreso */}
          <div className="flex justify-center gap-1.5 mb-5">
            {pasos.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === paso ? 20 : 6,
                  height: 6,
                  background: i === paso ? MARINO : i < paso ? 'rgba(10,31,61,0.3)' : '#e5e7eb',
                }}
              />
            ))}
          </div>

          <h2 className="text-xl font-black mb-2" style={{ color: MARINO }}>{step.titulo}</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-7">{step.descripcion}</p>

          <div className="flex gap-3">
            {paso > 0 && (
              <button
                onClick={anterior}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-semibold active:bg-gray-50 transition-colors"
              >
                Anterior
              </button>
            )}
            <button
              onClick={siguiente}
              className="flex-1 py-3 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 active:brightness-90 transition-all"
              style={{ background: MARINO }}
            >
              {paso === 0 ? 'Empezar tour' : '¡Listo!'}
              <ChevronRight size={15} />
            </button>
          </div>

          {paso === 0 && (
            <button
              onClick={cerrar}
              className="mt-4 text-xs text-gray-400 hover:text-gray-500 transition-colors"
            >
              Omitir tutorial
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── SPOTLIGHT (paso con selector) ─────────────────────────────────────────
  if (!rect) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: OVERLAY }}>
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#fff' }}
        />
      </div>
    )
  }

  const VH = window.innerHeight
  const VW = window.innerWidth

  const sTop    = Math.max(0, rect.top - PAD)
  const sLeft   = Math.max(0, rect.left - PAD)
  const sW      = Math.min(VW - sLeft, rect.width + PAD * 2)
  const sH      = rect.height + PAD * 2
  const sBottom = sTop + sH

  // Tooltip: abajo si hay espacio, si no arriba
  const TOOLTIP_H   = 185
  const spaceBelow  = VH - sBottom
  const arriba      = spaceBelow < TOOLTIP_H + 16

  const tooltipW    = Math.min(300, VW - 24)
  const tooltipLeft = Math.max(12, Math.min(sLeft, VW - tooltipW - 12))

  const esAntepenultimo = paso === total - 2

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">

      {/* 4 rectángulos de overlay */}
      <div className="absolute pointer-events-auto"
        style={{ top: 0, left: 0, right: 0, height: sTop, background: OVERLAY }}
        onClick={cerrar}
      />
      <div className="absolute pointer-events-auto"
        style={{ top: sTop, left: 0, width: sLeft, height: sH, background: OVERLAY }}
        onClick={cerrar}
      />
      <div className="absolute pointer-events-auto"
        style={{ top: sTop, left: sLeft + sW, right: 0, height: sH, background: OVERLAY }}
        onClick={cerrar}
      />
      <div className="absolute pointer-events-auto"
        style={{ top: sBottom, left: 0, right: 0, bottom: 0, background: OVERLAY }}
        onClick={cerrar}
      />

      {/* Anillo dorado sobre el elemento */}
      <div
        className="absolute rounded-2xl pointer-events-none"
        style={{
          top: sTop, left: sLeft, width: sW, height: sH,
          boxShadow: `0 0 0 3px ${DORADO}, 0 0 28px rgba(201,162,39,0.35)`,
        }}
      />

      {/* Tarjeta tooltip */}
      <div
        className="absolute pointer-events-auto"
        style={{
          left: tooltipLeft,
          width: tooltipW,
          ...(arriba ? { bottom: VH - sTop + 12 } : { top: sBottom + 12 }),
        }}
      >
        <div className="rounded-2xl shadow-2xl p-4" style={{ background: '#fff' }}>

          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-lg select-none">{step.icono}</span>
              <h3 className="font-black text-sm" style={{ color: MARINO }}>{step.titulo}</h3>
            </div>
            <button
              onClick={cerrar}
              className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0"
            >
              <X size={15} />
            </button>
          </div>

          <p className="text-xs text-gray-500 leading-relaxed mb-4">{step.descripcion}</p>

          <div className="flex items-center justify-between gap-2">
            {/* Puntos */}
            <div className="flex gap-1">
              {pasos.map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: i === paso ? 16 : 5,
                    height: 5,
                    background: i === paso ? MARINO : i < paso ? 'rgba(10,31,61,0.3)' : '#e5e7eb',
                  }}
                />
              ))}
            </div>

            {/* Botones */}
            <div className="flex gap-1.5 flex-shrink-0">
              {paso > 0 && (
                <button
                  onClick={anterior}
                  className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 active:bg-gray-50"
                >
                  <ChevronLeft size={14} />
                </button>
              )}
              <button
                onClick={siguiente}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-white text-xs font-bold active:brightness-90"
                style={{ background: MARINO }}
              >
                {esAntepenultimo ? 'Finalizar' : 'Siguiente'}
                <ChevronRight size={13} />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
