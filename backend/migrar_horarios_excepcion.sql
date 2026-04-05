-- Migración: tabla de excepciones de horario por fecha
-- Ejecutar una sola vez sobre la base de datos existente
-- Fecha: 2026-03-24

USE ceaune_asistencia;

CREATE TABLE IF NOT EXISTS horarios_excepcion (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  nivel ENUM('inicial','primaria','secundaria','todos') NOT NULL,
  fecha DATE NOT NULL,
  hora_ingreso_fin TIME NULL,
  hora_salida_inicio TIME NULL,
  hora_cierre_faltas TIME NULL,
  motivo VARCHAR(200) NOT NULL,
  created_by CHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES usuarios(id),
  UNIQUE KEY uq_excepcion_nivel_fecha (nivel, fecha),
  INDEX idx_excepcion_fecha (fecha)
);
