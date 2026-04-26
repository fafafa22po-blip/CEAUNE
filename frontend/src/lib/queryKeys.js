/**
 * Claves centralizadas de React Query.
 * Usar las mismas claves en distintos componentes
 * garantiza que compartan caché sin requests duplicados.
 */
export const QK = {
  // ── Apoderado ──────────────────────────────────────────────
  misHijos:    ['apoderado', 'mis-hijos'],
  comunicados: ['apoderado', 'comunicados'],
  datosHijo:   (id) => ['apoderado', 'datos-hijo', id],
  asistencias: (id, mesAnio) => ['apoderado', 'asistencias', id, mesAnio],
  contactos:   (id)         => ['apoderado', 'contactos',   id],
  horario:     (id, anio)   => ['apoderado', 'horario',     id, anio],
  horarioArchivo: (id, anio) => ['apoderado', 'horario-archivo', id, anio],

  // ── Tutor ──────────────────────────────────────────────────
  tutorAula:        ['tutor', 'mi-aula'],
  tutorEstudiantes: (fecha) => ['tutor', 'estudiantes', fecha || 'hoy'],
  tutorEstadisticas:(mes, anio) => ['tutor', 'estadisticas', mes, anio],
  tutorHistorial:   (dias) => ['tutor', 'historial', dias],
  tutorApoderados:  ['tutor', 'apoderados'],
  tutorObservaciones: (params) => ['tutor', 'observaciones', params],
  tutorFicha:       (id) => ['tutor', 'ficha', id],
  tutorSeguimiento: (id, mes, anio) => ['tutor', 'seguimiento', id, mes, anio],
  tutorAlertas:     ['tutor', 'alertas'],
  tutorComparativa: (mes, anio) => ['tutor', 'comparativa', mes, anio],
  tutorReuniones:   (params) => ['tutor', 'reuniones', params],
  tutorLibretas:    (bimestre, anio) => ['tutor', 'libretas', bimestre, anio],
  tutorComunicados: (pagina) => ['tutor', 'comunicados', pagina],
  tutorRecojoHoy:   ['tutor', 'recojo-hoy'],

  // ── Apoderado (libretas) ───────────────────────────────────
  apoderadoLibretas: (hijoId, anio) => ['apoderado', 'libretas', hijoId, anio],

  // ── Directivo ──────────────────────────────────────────────
  directivoSupervision:    (fecha) => ['directivo', 'supervision', fecha],
  directivoAuxDetalle:     (id, fecha) => ['directivo', 'aux-detalle', id, fecha],
  directivoTutorDetalle:   (id) => ['directivo', 'tutor-detalle', id],
  directivoCirculares:     ['directivo', 'circulares'],
  directivoComunicados:    (id, pagina, q, filtro) => ['directivo', 'comunicados', id, pagina, q, filtro],
  directivoJustificaciones:(nivel, estado, pagina)  => ['directivo', 'justificaciones', nivel, estado, pagina],

  // ── Personal (tutor / auxiliar) — bandeja de avisos ────────
  personalAvisos:       ['personal', 'avisos'],
  personalAvisosSinLeer:['personal', 'avisos-sin-leer'],

  // ── Apoderado (estadísticas + días no laborables) ─────────
  resumenMes:      (hijoId, mes, anio) => ['apoderado', 'resumen-mes',      hijoId, mes, anio],
  diasNoLab:       (hijoId, mes, anio) => ['apoderado', 'dias-no-lab',      hijoId, mes, anio],
  recojoCalendario:(hijoId, mes, anio) => ['apoderado', 'recojo-calendario', hijoId, mes, anio],
}
