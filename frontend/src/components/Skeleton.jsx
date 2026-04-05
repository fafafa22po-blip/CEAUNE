/** Componentes de skeleton para estados de carga */

function Shimmer({ className = '' }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />
}

/** Skeleton para la tarjeta de un hijo en el dashboard */
export function SkeletonTarjetaHijo() {
  return (
    <div className="card space-y-4">
      {/* Cabecera hijo */}
      <div className="flex items-center gap-3">
        <Shimmer className="w-11 h-11 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Shimmer className="h-4 w-40" />
          <Shimmer className="h-3 w-24" />
        </div>
      </div>
      {/* Estado hoy */}
      <Shimmer className="h-12 rounded-xl" />
      {/* Barra de progreso */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Shimmer className="h-3 w-20" />
          <Shimmer className="h-3 w-16" />
        </div>
        <Shimmer className="h-2 w-full rounded-full" />
        <Shimmer className="h-3 w-24" />
      </div>
    </div>
  )
}

/** Skeleton para el header del saludo */
export function SkeletonSaludo() {
  return (
    <div className="space-y-1.5">
      <Shimmer className="h-7 w-52" />
      <Shimmer className="h-4 w-36" />
    </div>
  )
}

/** Skeleton para el calendario de asistencias */
export function SkeletonCalendario() {
  return (
    <div className="card space-y-4">
      {/* Hero con porcentaje */}
      <div className="space-y-3">
        <div className="flex justify-between">
          <Shimmer className="h-5 w-40" />
          <div className="flex gap-1">
            <Shimmer className="h-7 w-7 rounded-lg" />
            <Shimmer className="h-7 w-7 rounded-lg" />
          </div>
        </div>
        <Shimmer className="h-12 w-24" />
        <Shimmer className="h-2 w-full rounded-full" />
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map(i => (
            <Shimmer key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

/** Skeleton para la cuadrícula del calendario L-V */
export function SkeletonGrillaCalendario() {
  return (
    <div className="card space-y-3">
      <Shimmer className="h-4 w-24" />
      <div className="grid grid-cols-5 gap-2 mb-2">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie'].map(d => (
          <div key={d} className="text-center text-xs font-semibold text-gray-300">{d}</div>
        ))}
        {Array.from({ length: 25 }).map((_, i) => (
          <Shimmer key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

/** Skeleton para la lista de comunicados */
export function SkeletonListaComunicados() {
  return (
    <div className="divide-y divide-gray-50">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="px-4 py-4 space-y-2">
          <div className="flex items-center gap-2">
            <Shimmer className="w-2 h-2 rounded-full flex-shrink-0" />
            <Shimmer className="h-4 w-3/4" />
          </div>
          <Shimmer className="h-3 w-1/3 ml-4" />
        </div>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Skeletons del AUXILIAR
   ═══════════════════════════════════════════════════════════════════ */

/** Skeleton para el dashboard del auxiliar (banner + KPIs + stats + listas) */
export function SkeletonAuxiliarInicio() {
  return (
    <div className="space-y-6">
      {/* Banner */}
      <Shimmer className="h-44 rounded-2xl" />

      {/* KPI cards 2x2 → 4 cols en lg */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card space-y-3">
            <div className="flex justify-between">
              <div className="space-y-2">
                <Shimmer className="h-3 w-24" />
                <Shimmer className="h-8 w-12" />
                <Shimmer className="h-3 w-28" />
              </div>
              <Shimmer className="w-10 h-10 rounded-xl flex-shrink-0" />
            </div>
            <Shimmer className="h-1.5 rounded-full" />
          </div>
        ))}
      </div>

      {/* Cards de stats: distribución + ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card space-y-4">
            <div className="flex justify-between">
              <Shimmer className="h-4 w-40" />
              <Shimmer className="h-3 w-16" />
            </div>
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="space-y-1.5">
                <div className="flex justify-between">
                  <Shimmer className="h-3 w-20" />
                  <Shimmer className="h-3 w-12" />
                </div>
                <Shimmer className="h-2 rounded-full" />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Listas: incidencias + justificaciones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card space-y-1">
            <div className="flex justify-between mb-3">
              <Shimmer className="h-4 w-36" />
              <Shimmer className="h-3 w-16" />
            </div>
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                <Shimmer className="w-8 h-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Shimmer className="h-3.5 w-36" />
                  <Shimmer className="h-3 w-20" />
                </div>
                <Shimmer className="h-5 w-14 rounded-full flex-shrink-0" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Skeletons del TUTOR
   ═══════════════════════════════════════════════════════════════════ */

/** Skeleton para el dashboard del tutor (banner + KPIs + grids) */
export function SkeletonTutorInicio() {
  return (
    <div className="space-y-5">
      {/* Banner */}
      <Shimmer className="h-44 rounded-2xl" />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card space-y-3">
            <div className="flex justify-between">
              <div className="space-y-2">
                <Shimmer className="h-3 w-24" />
                <Shimmer className="h-8 w-16" />
              </div>
              <Shimmer className="w-10 h-10 rounded-xl" />
            </div>
            <Shimmer className="h-1.5 rounded-full" />
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Shimmer key={i} className="h-12 flex-1 rounded-xl" />
        ))}
      </div>

      {/* Grid inferior */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card space-y-3">
          <Shimmer className="h-5 w-40" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Shimmer key={i} className="h-14 rounded-xl" />
          ))}
        </div>
        <div className="card space-y-3">
          <Shimmer className="h-5 w-40" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Shimmer key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

/** Skeleton para la lista de estudiantes (Mi Aula) */
export function SkeletonTutorEstudiantes() {
  return (
    <div className="space-y-4">
      <Shimmer className="h-10 w-full rounded-xl" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Shimmer key={i} className="h-8 w-20 rounded-lg" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card flex items-center gap-3">
            <Shimmer className="w-9 h-9 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Shimmer className="h-4 w-40" />
              <Shimmer className="h-3 w-24" />
            </div>
            <Shimmer className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Skeleton para la grilla del historial (tab semana) */
export function SkeletonTutorHistorial() {
  return (
    <div className="card space-y-3">
      <div className="flex justify-between">
        <Shimmer className="h-5 w-32" />
        <Shimmer className="h-8 w-24 rounded-lg" />
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-100">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-2 px-3 py-3 border-b border-gray-50">
            <Shimmer className="h-4 w-32 flex-shrink-0" />
            {Array.from({ length: 5 }).map((_, j) => (
              <Shimmer key={j} className="h-6 w-6 rounded flex-shrink-0" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Skeleton para seguimiento de un estudiante */
export function SkeletonTutorSeguimiento() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Sidebar */}
        <div className="card space-y-4">
          <div className="flex items-center gap-3">
            <Shimmer className="w-14 h-14 rounded-full" />
            <div className="space-y-2 flex-1">
              <Shimmer className="h-5 w-32" />
              <Shimmer className="h-3 w-20" />
            </div>
          </div>
          <Shimmer className="h-24 w-24 rounded-full mx-auto" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Shimmer key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        </div>
        {/* Timeline */}
        <div className="lg:col-span-2 space-y-3">
          <Shimmer className="h-10 w-full rounded-xl" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Shimmer key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

/** Skeleton para la lista de observaciones */
export function SkeletonTutorObservaciones() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card space-y-4">
        <Shimmer className="h-5 w-40" />
        <Shimmer className="h-10 rounded-xl" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Shimmer key={i} className="h-8 w-20 rounded-lg" />
          ))}
        </div>
        <Shimmer className="h-24 rounded-xl" />
        <Shimmer className="h-10 rounded-xl" />
      </div>
      <div className="space-y-3">
        <Shimmer className="h-5 w-32" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card space-y-2">
            <Shimmer className="h-4 w-40" />
            <Shimmer className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
