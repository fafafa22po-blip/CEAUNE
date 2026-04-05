-- Migración: agrega columna motivo_especial a la tabla asistencia
-- Ejecutar una sola vez sobre la base de datos existente
-- Fecha: 2026-03-24

USE ceaune_asistencia;

ALTER TABLE asistencia
  ADD COLUMN motivo_especial ENUM(
    'marcha',
    'juegos_deportivos',
    'enfermedad',
    'permiso_apoderado',
    'actividad_institucional',
    'tardanza_justificada',
    'otro'
  ) NULL
  AFTER estado;
