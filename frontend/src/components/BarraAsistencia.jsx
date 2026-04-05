/**
 * BarraAsistencia — indicador visual de porcentaje de asistencia
 * Muestra zonas de riesgo/regular/bien con marcador, umbrales y mensaje contextual.
 *
 * Props:
 *   pct      number  0-100 porcentaje actual
 *   diasLab  number  días escolares transcurridos en el mes
 *   faltas   number  faltas explícitas registradas
 *   size     'sm' | 'md'  (sm = compacto para tarjetas, md = hero de página)
 */
export function BarraAsistencia({ pct, diasLab, faltas, size = 'sm' }) {
  const UMBRAL_RIESGO = 70   // bajo → riesgo de desaprobación
  const UMBRAL_BIEN   = 90   // alto → excelente

  // ── Posición del marcador (clampeada para que nunca salga del borde) ──────
  const markerPos = Math.min(Math.max(pct ?? 100, 2), 98)

  // ── Color del marcador según zona ────────────────────────────────────────
  const markerColor =
    pct >= UMBRAL_BIEN   ? '#22c55e' :   // verde
    pct >= UMBRAL_RIESGO ? '#f59e0b' :   // ámbar
                           '#ef4444'     // rojo

  // ── Margen: cuántas faltas más puede tener sin bajar del umbral ───────────
  const maxFaltasPermitidas = diasLab > 0 ? Math.floor(diasLab * (1 - UMBRAL_RIESGO / 100)) : 0
  const margen = diasLab > 0 ? Math.max(0, maxFaltasPermitidas - (faltas ?? 0)) : null
  const exceso = diasLab > 0 ? Math.max(0, (faltas ?? 0) - maxFaltasPermitidas) : 0

  // ── Mensaje contextual ────────────────────────────────────────────────────
  let msg, msgColor

  if (diasLab === 0) {
    msg      = 'Aún no hay días escolares este mes'
    msgColor = 'text-gray-400'
  } else if (pct >= UMBRAL_BIEN) {
    msg      = '¡Excelente asistencia!'
    msgColor = 'text-green-600'
  } else if (pct >= UMBRAL_RIESGO) {
    msg      = margen === 0
      ? 'Está en el límite mínimo'
      : `Puede faltar ${margen} día${margen !== 1 ? 's' : ''} más`
    msgColor = 'text-amber-600'
  } else {
    msg      = `Superó el límite por ${exceso} día${exceso !== 1 ? 's' : ''}`
    msgColor = 'text-red-600'
  }

  const isMd = size === 'md'

  return (
    <div className="space-y-1.5">

      {/* ── Barra tricolor + marcador ─────────────────────────────────── */}
      <div className={`relative ${isMd ? 'h-6' : 'h-5'} flex items-center`}>

        {/* Fondo: tres zonas de color */}
        <div className="w-full flex h-2 rounded-full overflow-hidden">
          <div className="bg-red-200"   style={{ width: '70%' }} />
          <div className="bg-amber-200" style={{ width: '20%' }} />
          <div className="bg-green-200" style={{ width: '10%' }} />
        </div>

        {/* Marcador circular */}
        <div
          className={`absolute rounded-full border-2 border-white shadow-md transition-all duration-700 ${isMd ? 'w-5 h-5' : 'w-4 h-4'}`}
          style={{
            left:            `${markerPos}%`,
            transform:       'translateX(-50%)',
            backgroundColor: markerColor,
          }}
        />
      </div>

      {/* ── Ticks de umbral (70% y 90%) ──────────────────────────────── */}
      <div className="relative h-5 text-[9px] font-bold select-none">
        {/* 70% */}
        <div
          className="absolute flex flex-col items-center gap-px"
          style={{ left: '70%', transform: 'translateX(-50%)' }}
        >
          <div className="w-px h-2 bg-red-300" />
          <span className="text-red-400">70%</span>
        </div>
        {/* 90% */}
        <div
          className="absolute flex flex-col items-center gap-px"
          style={{ left: '90%', transform: 'translateX(-50%)' }}
        >
          <div className="w-px h-2 bg-amber-300" />
          <span className="text-amber-400">90%</span>
        </div>

        {/* Etiquetas de zona en versión md */}
        {isMd && (
          <>
            <span className="absolute text-[8px] text-red-300 font-medium"
              style={{ left: '35%', transform: 'translateX(-50%)' }}>
              Riesgo
            </span>
            <span className="absolute text-[8px] text-amber-300 font-medium"
              style={{ left: '80%', transform: 'translateX(-50%)' }}>
              Regular
            </span>
            <span className="absolute text-[8px] text-green-400 font-medium"
              style={{ left: '96%', transform: 'translateX(-50%)' }}>
              Bien
            </span>
          </>
        )}
      </div>

      {/* ── Mensaje contextual ───────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-0.5">
        <p className={`font-semibold ${msgColor} ${isMd ? 'text-sm' : 'text-xs'}`}>
          {msg}
        </p>
        <p className="text-[10px] text-gray-400">
          mín. <span className="font-semibold text-gray-500">70%</span>
        </p>
      </div>

    </div>
  )
}
