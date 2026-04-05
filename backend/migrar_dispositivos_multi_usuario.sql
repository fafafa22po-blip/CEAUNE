-- ============================================================
-- Migración: Permitir múltiples usuarios por dispositivo (FCM)
-- Fecha: 2026-03-21
-- Problema: fcm_token tenía UNIQUE, solo 1 apoderado por celular
-- Solución: UNIQUE compuesto (fcm_token, usuario_id)
-- ============================================================

-- 1. Quitar el índice único viejo de fcm_token
ALTER TABLE dispositivos_usuario DROP INDEX fcm_token;

-- 2. Crear índice único compuesto (token + usuario)
--    Permite que el mismo dispositivo esté registrado para varios apoderados
ALTER TABLE dispositivos_usuario
  ADD UNIQUE INDEX uq_token_usuario (fcm_token, usuario_id);

-- 3. Índice para búsquedas rápidas por usuario (usado en debug y logout)
ALTER TABLE dispositivos_usuario
  ADD INDEX idx_dispositivo_usuario (usuario_id);
