import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ChevronRight, ChevronLeft } from 'lucide-react'
import { useTour } from '../context/TourContext'
import mascota from '../assets/mascota.png'

const MARINO  = '#0a1f3d'
const DORADO  = '#c9a227'
const OVERLAY = 'rgba(10, 31, 61, 0.80)'
const PAD     = 12

// ── Hook: obtiene el rect del elemento target ─────────────────────────────────
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
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setTimeout(() => {
          const r = el.getBoundingClientRect()
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
        }, 500)
        return
      }
      tries++
      if (tries < 60) timer = setTimeout(find, 100)
    }

    timer = setTimeout(find, 280)
    return () => clearTimeout(timer)
  }, [selector, activo, paso])

  return rect
}

// ── Puntos de progreso ────────────────────────────────────────────────────────
function Dots({ total, actual }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            width:      i === actual ? 18 : 6,
            height:     6,
            background: i === actual ? MARINO : i < actual ? 'rgba(10,31,61,0.25)' : '#e5e7eb',
          }}
        />
      ))}
    </div>
  )
}

// ── Modal centrado (bienvenida / fin) ─────────────────────────────────────────
function ModalCentrado({ step, paso, total, siguiente, anterior, cerrar }) {
  const esBienvenida = step.tipo === 'welcome'

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-5">
      <div
        className="absolute inset-0"
        style={{ background: OVERLAY }}
        onClick={esBienvenida ? undefined : cerrar}
      />

      <div
        className="relative z-10 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: '#fff' }}
      >
        {/* Header con mascota */}
        <div
          className="relative flex flex-col items-center pt-8 pb-6 px-6"
          style={{
            background: esBienvenida
              ? `linear-gradient(135deg, ${MARINO} 0%, #1a3a6e 100%)`
              : `linear-gradient(135deg, #b8860b 0%, ${DORADO} 100%)`,
          }}
        >
          <button
            onClick={cerrar}
            className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
            style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}
          >
            <X size={14} />
          </button>

          <img
            src={mascota}
            alt="Ceauno"
            className={`select-none ${esBienvenida ? 'animate-bounce' : ''}`}
            style={{ width: 110, height: 110, objectFit: 'contain', filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.3))' }}
          />

          {!esBienvenida && (
            <div className="mt-3 flex gap-1">
              {['✨', '🎉', '✨'].map((e, i) => (
                <span key={i} className="text-xl animate-bounce" style={{ animationDelay: `${i * 150}ms` }}>{e}</span>
              ))}
            </div>
          )}
        </div>

        {/* Cuerpo */}
        <div className="px-7 pt-5 pb-7">
          {/* Dots */}
          <div className="flex justify-center mb-4">
            <Dots total={total} actual={paso} />
          </div>

          <h2 className="text-xl font-black text-center mb-2" style={{ color: MARINO }}>
            {step.titulo}
          </h2>
          <p className="text-sm text-gray-500 text-center leading-relaxed mb-7">
            {step.descripcion}
          </p>

          {/* Botones */}
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
              className="flex-1 py-3.5 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 active:brightness-90 transition-all shadow-lg"
              style={{
                background: esBienvenida ? MARINO : DORADO,
                boxShadow: esBienvenida ? `0 4px 14px rgba(10,31,61,0.35)` : `0 4px 14px rgba(201,162,39,0.45)`,
              }}
            >
              {esBienvenida ? 'Empezar tour' : '¡Perfecto!'}
              <ChevronRight size={15} />
            </button>
          </div>

          {esBienvenida && (
            <button
              onClick={cerrar}
              className="mt-4 w-full text-xs text-gray-400 hover:text-gray-500 transition-colors text-center"
            >
              Omitir tutorial
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Spinner de carga ──────────────────────────────────────────────────────────
function SpinnerOverlay() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: OVERLAY }}>
      <div
        className="w-9 h-9 rounded-full border-[3px] animate-spin"
        style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#fff' }}
      />
    </div>
  )
}

// ── Tooltip del spotlight ─────────────────────────────────────────────────────
function Tooltip({ step, paso, total, siguiente, anterior, cerrar, top, left, width }) {
  const esUltimoSpotlight  = paso === total - 2
  const esperandoUsuario   = !!step.waitForInteraction

  return (
    <div
      className="absolute pointer-events-auto"
      style={{ top, left, width }}
    >
      <div className="rounded-2xl shadow-2xl overflow-hidden" style={{ background: '#fff' }}>

        {/* Header coloreado */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ background: MARINO }}
        >
          <div className="flex items-center gap-2">
            <span className="text-base select-none">{step.icono}</span>
            <h3 className="font-black text-sm text-white leading-tight">{step.titulo}</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-white/50">
              {paso + 1} / {total}
            </span>
            <button
              onClick={cerrar}
              className="w-5 h-5 rounded-full flex items-center justify-center transition-colors"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}
            >
              <X size={11} />
            </button>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="px-4 pt-3 pb-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            {step.descripcion}
          </p>

          {/* Hint interactivo o informativo */}
          {(esperandoUsuario || step.hint) && (
            <div
              className="flex items-start gap-2 mt-2.5 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(201,162,39,0.10)', border: '1px solid rgba(201,162,39,0.25)' }}
            >
              <span className="text-sm animate-bounce flex-shrink-0">👆</span>
              <p className="text-[10px] font-medium leading-snug" style={{ color: '#92660a' }}>
                {esperandoUsuario ? step.hint : step.hint}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-3">
            <Dots total={total} actual={paso} />

            <div className="flex gap-1.5 flex-shrink-0">
              {paso > 0 && (
                <button
                  onClick={anterior}
                  className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 active:bg-gray-50 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
              )}
              {!esperandoUsuario && (
                <button
                  onClick={siguiente}
                  className="flex items-center gap-1 px-3.5 py-2 rounded-xl text-white text-xs font-bold active:brightness-90 transition-all"
                  style={{ background: MARINO, boxShadow: `0 2px 8px rgba(10,31,61,0.3)` }}
                >
                  {esUltimoSpotlight ? 'Finalizar' : 'Siguiente'}
                  <ChevronRight size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function TourOverlay() {
  const { activo, paso, pasos, siguiente, anterior, cerrar } = useTour()
  const navigate = useNavigate()
  const step     = pasos[paso]

  // Navegar al cambiar de paso
  useEffect(() => {
    if (!activo) return
    if (step?.route) navigate(step.route)
  }, [activo, paso]) // eslint-disable-line

  const rect = useTargetRect(step?.selector, activo, paso)

  // waitForInteraction: avanza cuando el apoderado toca el elemento indicado
  useEffect(() => {
    if (!activo || !step?.waitForInteraction || !rect) return
    const target = document.querySelector(`[data-tour="${step.waitForInteraction}"]`)
    if (!target) return
    const onTap = () => setTimeout(() => siguiente(), 500)
    target.addEventListener('click', onTap, { once: true })
    return () => target.removeEventListener('click', onTap)
  }, [rect, activo, paso]) // eslint-disable-line

  if (!activo) return null

  const esCentrado = !step.selector
  const total      = pasos.length

  // ── Modal centrado (bienvenida / fin) ─────────────────────────────────────
  if (esCentrado) {
    return (
      <ModalCentrado
        step={step}
        paso={paso}
        total={total}
        siguiente={siguiente}
        anterior={anterior}
        cerrar={cerrar}
      />
    )
  }

  // ── Spotlight ─────────────────────────────────────────────────────────────
  if (!rect) return <SpinnerOverlay />

  const VH = window.innerHeight
  const VW = window.innerWidth

  const sTop    = Math.max(0, rect.top  - PAD)
  const sLeft   = Math.max(0, rect.left - PAD)
  const sW      = Math.min(VW - sLeft, rect.width  + PAD * 2)
  const sH      = rect.height + PAD * 2
  const sBottom = sTop + sH

  const TOOLTIP_H = 260   // alto real estimado (descripcion + hint + footer)
  const GAP       = 12
  const MARGIN    = 8
  const tooltipW  = Math.min(312, VW - 24)

  // Centro el tooltip sobre el spotlight; clampo a los bordes
  const tooltipLeft = Math.max(MARGIN, Math.min(
    sLeft + (sW - tooltipW) / 2,
    VW - tooltipW - MARGIN
  ))

  // Posición vertical: abajo si hay espacio, arriba si no, siempre dentro del viewport
  const roomBelow = VH - sBottom - GAP
  const roomAbove = sTop - GAP
  let tooltipTop
  if (roomBelow >= TOOLTIP_H) {
    tooltipTop = sBottom + GAP
  } else if (roomAbove >= TOOLTIP_H) {
    tooltipTop = sTop - GAP - TOOLTIP_H
  } else {
    // No hay espacio ideal — elegir el lado con más espacio y clampear
    tooltipTop = roomBelow >= roomAbove ? sBottom + GAP : sTop - GAP - TOOLTIP_H
  }
  tooltipTop = Math.max(MARGIN, Math.min(tooltipTop, VH - TOOLTIP_H - MARGIN))

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">

      {/* ── 4 rectángulos de overlay ───────────────────────────────────────── */}
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

      {/* ── Bloqueo permanente de la barra de navegación ─────────────────── */}
      <div
        className="fixed bottom-0 inset-x-0 pointer-events-auto"
        style={{ height: 'calc(var(--nav-h, 64px) + env(safe-area-inset-bottom, 0px))', background: 'transparent', zIndex: 1 }}
        onClick={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
      />

      {/* ── Anillo dorado pulsante ─────────────────────────────────────────── */}
      <div
        className="absolute rounded-2xl pointer-events-none"
        style={{
          top: sTop, left: sLeft, width: sW, height: sH,
          boxShadow: `0 0 0 3px ${DORADO}, 0 0 32px rgba(201,162,39,0.40)`,
          animation: 'tourPulse 2s ease-in-out infinite',
        }}
      />

      {/* ── Tooltip ────────────────────────────────────────────────────────── */}
      <Tooltip
        step={step}
        paso={paso}
        total={total}
        siguiente={siguiente}
        anterior={anterior}
        cerrar={cerrar}
        top={tooltipTop}
        left={tooltipLeft}
        width={tooltipW}
      />

    </div>
  )
}
