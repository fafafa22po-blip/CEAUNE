/**
 * Configuración académica de niveles, grados y secciones/aulas.
 *
 * - Inicial  : aulas identificadas por color, agrupadas por edad (años)
 * - Primaria : secciones por grado (1°-3° y 6° → A,B  |  4°-5° → A,B,C)
 * - Secundaria: secciones A–E para todos los grados
 */

export const GRADOS_POR_NIVEL = {
  inicial:    ['2', '3', '4', '5'],
  primaria:   ['1', '2', '3', '4', '5', '6'],
  secundaria: ['1', '2', '3', '4', '5'],
}

/** Aulas de inicial organizadas por edad (grado = años) */
export const AULAS_INICIAL = {
  '2': ['Amarilla'],
  '3': ['Crema', 'Blanca'],
  '4': ['Verde Limon', 'Rosada'],
  '5': ['Celeste', 'Lila'],
}

/** Secciones de primaria por grado */
export const SECCIONES_PRIMARIA = {
  '1': ['A', 'B'],
  '2': ['A', 'B'],
  '3': ['A', 'B'],
  '4': ['A', 'B', 'C'],
  '5': ['A', 'B', 'C'],
  '6': ['A', 'B'],
}

/** Secciones para secundaria (iguales en todos los grados) */
export const SECCIONES_SECUNDARIA = ['A', 'B', 'C', 'D', 'E']

/**
 * Convierte la letra de sección ("A", "B"…) al nombre de color del aula inicial.
 * Si ya viene con el nombre de color, lo devuelve sin cambios.
 *   ("3", "A") → "Crema"   ("4", "B") → "Rosada"
 */
export function resolveAulaInicial(grado, seccion) {
  if (!seccion) return seccion
  const colores = AULAS_INICIAL[grado] || []
  const idx = seccion.charCodeAt(0) - 65  // 'A'=0, 'B'=1, 'C'=2…
  if (seccion.length === 1 && idx >= 0 && idx < colores.length) {
    return colores[idx]
  }
  return seccion  // ya es nombre de color
}

/**
 * Retorna las secciones/aulas válidas para un nivel+grado dado.
 * Para inicial devuelve las letras (A, B…) que corresponden a los colores.
 * Para primaria depende del grado. Para secundaria son fijas.
 */
export function getSecciones(nivel, grado) {
  if (nivel === 'inicial') {
    const colores = AULAS_INICIAL[grado] || []
    return colores.map((_, i) => String.fromCharCode(65 + i))  // ['A', 'B', …]
  }
  if (nivel === 'primaria') return SECCIONES_PRIMARIA[grado] || []
  if (nivel === 'secundaria') return SECCIONES_SECUNDARIA
  return []
}

/**
 * Formatea grado+sección para mostrar en la UI.
 *   inicial    → "3 años — Aula Crema"  (convierte "A" → nombre del color)
 *   primaria   → "1° A"
 *   secundaria → "3° B"
 */
export function formatGradoSeccion(nivel, grado, seccion) {
  if (nivel === 'inicial') return `${grado} años — Aula ${resolveAulaInicial(grado, seccion)}`
  return `${grado}° ${seccion}`
}

/**
 * Formatea solo el grado.
 *   inicial    → "3 años"
 *   otros      → "3°"
 */
export function formatGrado(nivel, grado) {
  if (nivel === 'inicial') return `${grado} años`
  return `${grado}°`
}

/**
 * Etiqueta para el campo "sección" según el nivel.
 *   inicial → "Aula"
 *   otros   → "Sección"
 */
export function labelSeccion(nivel) {
  return nivel === 'inicial' ? 'Aula' : 'Sección'
}

/**
 * Todas las combinaciones grado+sección válidas para un nivel dado,
 * como array de objetos { grado, seccion }.
 */
export function getAulasDeNivel(nivel) {
  const grados = GRADOS_POR_NIVEL[nivel] || []
  return grados.flatMap(g => getSecciones(nivel, g).map(s => ({ grado: g, seccion: s })))
}
