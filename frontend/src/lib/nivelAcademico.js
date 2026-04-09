/**
 * Configuración académica de niveles, grados y secciones/aulas.
 *
 * - Inicial  : aulas identificadas por color, agrupadas por edad (años)
 * - Primaria : secciones A y B para todos los grados
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

/** Secciones para primaria y secundaria (iguales en todos los grados) */
export const SECCIONES_POR_NIVEL = {
  primaria:   ['A', 'B'],
  secundaria: ['A', 'B', 'C', 'D', 'E'],
}

/**
 * Retorna las secciones/aulas válidas para un nivel+grado dado.
 * Para inicial depende del grado; para primaria/secundaria son fijas.
 */
export function getSecciones(nivel, grado) {
  if (nivel === 'inicial') return AULAS_INICIAL[grado] || []
  return SECCIONES_POR_NIVEL[nivel] || []
}

/**
 * Formatea grado+sección para mostrar en la UI.
 *   inicial    → "3 años — Aula Crema"
 *   primaria   → "1° A"
 *   secundaria → "3° B"
 */
export function formatGradoSeccion(nivel, grado, seccion) {
  if (nivel === 'inicial') return `${grado} años — Aula ${seccion}`
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
