SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

CREATE DATABASE IF NOT EXISTS ceaune_fase1
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ceaune_fase1;

-- USUARIOS (auxiliar, admin, apoderado)
CREATE TABLE IF NOT EXISTS usuarios (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  dni VARCHAR(8) UNIQUE NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('apoderado','auxiliar','admin') NOT NULL,
  telefono VARCHAR(15) NULL,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ESTUDIANTES (solo secundaria en esta fase)
CREATE TABLE IF NOT EXISTS estudiantes (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  dni VARCHAR(8) UNIQUE NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  grado VARCHAR(10) NOT NULL,
  seccion VARCHAR(5) NOT NULL,
  qr_token VARCHAR(100) UNIQUE NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- RELACIÓN APODERADO → HIJO
CREATE TABLE IF NOT EXISTS apoderados_estudiantes (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  apoderado_id CHAR(36) NOT NULL,
  estudiante_id CHAR(36) NOT NULL,
  FOREIGN KEY (apoderado_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE,
  UNIQUE KEY uq_apoderado_estudiante (apoderado_id, estudiante_id)
);

-- HORARIO SECUNDARIA
CREATE TABLE IF NOT EXISTS horario_secundaria (
  id INT PRIMARY KEY DEFAULT 1,
  hora_ingreso_limite TIME NOT NULL DEFAULT '07:45:00',
  hora_salida_inicio TIME NOT NULL DEFAULT '15:15:00',
  hora_cierre_registro TIME NOT NULL DEFAULT '15:00:00'
);

INSERT INTO horario_secundaria (id, hora_ingreso_limite, hora_salida_inicio, hora_cierre_registro)
VALUES (1, '07:45:00', '15:15:00', '15:00:00')
ON DUPLICATE KEY UPDATE id=id;

-- ASISTENCIA
CREATE TABLE IF NOT EXISTS asistencia (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  estudiante_id CHAR(36) NOT NULL,
  auxiliar_id CHAR(36) NULL,
  fecha DATE NOT NULL DEFAULT (CURDATE()),
  tipo ENUM('ingreso','salida','ingreso_especial','salida_especial') NOT NULL,
  hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado ENUM('puntual','tardanza','falta','especial') NOT NULL,
  observacion TEXT NULL,
  correo_enviado BOOLEAN DEFAULT FALSE,
  correo_enviado_at DATETIME NULL,
  FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id),
  FOREIGN KEY (auxiliar_id) REFERENCES usuarios(id),
  INDEX idx_fecha (fecha),
  INDEX idx_estudiante_fecha (estudiante_id, fecha)
);

-- DATOS DE PRUEBA
-- Passwords: admin123, auxiliar123, apoderado123 (bcrypt)
-- ESTUDIANTES DE PRUEBA
INSERT IGNORE INTO estudiantes (id, dni, nombre, apellido, grado, seccion, qr_token) VALUES
(UUID(), '10000001', 'Carlos', 'Quispe Torres',  '1ro', 'A', UUID()),
(UUID(), '10000002', 'Ana',    'Mamani Lima',    '1ro', 'A', UUID()),
(UUID(), '10000003', 'Luis',   'Flores Chávez',  '2do', 'B', UUID()),
(UUID(), '10000004', 'Rosa',   'García Paredes', '3ro', 'A', UUID()),
(UUID(), '10000005', 'Miguel', 'Torres Huanca',  '4to', 'C', UUID());

-- USUARIOS DE PRUEBA
-- Passwords: admin=admin123, auxiliar=auxiliar123, apoderado=apoderado123
INSERT IGNORE INTO usuarios (id, dni, nombre, apellido, email, password_hash, rol) VALUES
(UUID(), '00000001', 'Admin', 'CEAUNE', 'admin@ceaune.edu.pe',
 '$2b$12$HxzYpz6Plh55dOVaHYYpDe6qBrurLk.ZglxL7KVhjmyePEJySF/OG', 'admin'),
(UUID(), '00000002', 'Juan', 'Auxiliar', 'auxiliar@ceaune.edu.pe',
 '$2b$12$IfwdwrV5KIIC2lcoUMKi6eRMdtLami1ccF.0lXwaRMV1wLz6jQ2tm', 'auxiliar'),
(UUID(), '00000003', 'María', 'Apoderado', 'apoderado@gmail.com',
 '$2b$12$ubta6R9qTEFNqH13Mt.eTeZhM9/x5KjR8.1UkrDJxkCsW4OUxPKs6', 'apoderado');
