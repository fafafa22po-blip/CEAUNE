CREATE DATABASE IF NOT EXISTS ceaune_asistencia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ceaune_asistencia;

CREATE TABLE usuarios (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  dni VARCHAR(8) UNIQUE NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('apoderado','tutor','i-auxiliar','p-auxiliar','s-auxiliar','admin') NOT NULL,
  nivel ENUM('inicial','primaria','secundaria','todos') NULL,
  telefono VARCHAR(15) NULL,
  foto_url TEXT NULL,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE estudiantes (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  dni VARCHAR(8) UNIQUE NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  sexo VARCHAR(1) NULL,
  nivel ENUM('inicial','primaria','secundaria') NOT NULL,
  grado VARCHAR(10) NOT NULL,
  seccion VARCHAR(5) NOT NULL,
  qr_token VARCHAR(100) UNIQUE NOT NULL,
  foto_url TEXT NULL,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  motivo_desactivacion VARCHAR(50) NULL,
  desactivado_en TIMESTAMP NULL,
  desactivado_por CHAR(36) NULL,
  -- Salud y necesidades especiales (todos opcionales)
  atencion_medica ENUM('ESSALUD','MINSA','SIS','NINGUNO','OTRO') NULL,
  tiene_alergias BOOLEAN NULL,
  alergias_detalle TEXT NULL,
  condicion_mental_nee TEXT NULL,
  contacto_emergencia TEXT NULL
);

CREATE TABLE apoderados_estudiantes (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  apoderado_id CHAR(36) NOT NULL,
  estudiante_id CHAR(36) NOT NULL,
  FOREIGN KEY (apoderado_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id) ON DELETE CASCADE,
  UNIQUE KEY uq_ap_est (apoderado_id, estudiante_id)
);

CREATE TABLE tutores_aulas (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  tutor_id CHAR(36) NOT NULL UNIQUE,
  nivel ENUM('inicial','primaria','secundaria') NOT NULL,
  grado VARCHAR(10) NOT NULL,
  seccion VARCHAR(5) NOT NULL,
  anio INT NOT NULL DEFAULT (YEAR(CURDATE())),
  FOREIGN KEY (tutor_id) REFERENCES usuarios(id)
);

CREATE TABLE horarios (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  nivel ENUM('inicial','primaria','secundaria') NOT NULL UNIQUE,
  hora_ingreso_inicio TIME NOT NULL,
  hora_ingreso_fin TIME NOT NULL,
  hora_salida_inicio TIME NOT NULL,
  hora_salida_fin TIME NOT NULL,
  hora_cierre_faltas TIME NOT NULL
);

INSERT INTO horarios (id, nivel, hora_ingreso_inicio, hora_ingreso_fin, hora_salida_inicio, hora_salida_fin, hora_cierre_faltas) VALUES
(UUID(), 'inicial',    '07:15:00','08:00:00','13:00:00','14:00:00','14:00:00'),
(UUID(), 'primaria',   '07:15:00','08:00:00','13:00:00','14:00:00','14:00:00'),
(UUID(), 'secundaria', '07:00:00','07:45:00','15:15:00','16:00:00','15:00:00');

CREATE TABLE horarios_excepcion (
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

CREATE TABLE dias_no_laborables (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  fecha DATE NOT NULL UNIQUE,
  tipo VARCHAR(20) NOT NULL DEFAULT 'feriado',
  nivel VARCHAR(20) NOT NULL DEFAULT 'todos',
  grado VARCHAR(5) NULL,
  seccion VARCHAR(2) NULL,
  motivo VARCHAR(200) NOT NULL,
  created_by CHAR(36) NULL,
  FOREIGN KEY (created_by) REFERENCES usuarios(id)
);

CREATE TABLE asistencia (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  estudiante_id CHAR(36) NOT NULL,
  auxiliar_id CHAR(36) NULL,
  fecha DATE NOT NULL DEFAULT (CURDATE()),
  tipo ENUM('ingreso','salida','ingreso_especial','salida_especial') NOT NULL,
  hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado ENUM('puntual','tardanza','falta','especial') NOT NULL,
  motivo_especial ENUM(
    'marcha',
    'juegos_deportivos',
    'enfermedad',
    'permiso_apoderado',
    'actividad_institucional',
    'tardanza_justificada',
    'otro'
  ) NULL,
  observacion TEXT NULL,
  correo_enviado BOOLEAN DEFAULT FALSE,
  correo_enviado_at DATETIME NULL,
  FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id),
  FOREIGN KEY (auxiliar_id) REFERENCES usuarios(id),
  INDEX idx_fecha (fecha),
  INDEX idx_est_fecha (estudiante_id, fecha)
);

CREATE TABLE justificaciones (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  asistencia_id CHAR(36) NOT NULL,
  apoderado_id CHAR(36) NOT NULL,
  motivo TEXT NOT NULL,
  adjunto_nombre VARCHAR(200) NULL,
  adjunto_drive_url TEXT NULL,
  estado ENUM('pendiente','aprobada','rechazada') DEFAULT 'pendiente',
  revisado_por CHAR(36) NULL,
  revisado_at DATETIME NULL,
  observacion_revision TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (asistencia_id) REFERENCES asistencia(id),
  FOREIGN KEY (apoderado_id) REFERENCES usuarios(id)
);

CREATE TABLE observaciones_tutor (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  tutor_id CHAR(36) NOT NULL,
  estudiante_id CHAR(36) NOT NULL,
  tipo ENUM('academica','conductual','salud','logro','otro') NOT NULL,
  descripcion TEXT NOT NULL,
  enviar_a_apoderado BOOLEAN DEFAULT TRUE,
  correo_enviado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tutor_id) REFERENCES usuarios(id),
  FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id)
);

CREATE TABLE comunicados (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  auxiliar_id CHAR(36) NOT NULL,
  batch_id CHAR(36) NOT NULL,
  asunto VARCHAR(200) NOT NULL,
  mensaje TEXT NOT NULL,
  adjunto_nombre VARCHAR(200) NULL,
  adjunto_drive_url TEXT NULL,
  tipo_envio ENUM('individual','aula','masivo') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (auxiliar_id) REFERENCES usuarios(id)
);

CREATE TABLE comunicado_destinatarios (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  comunicado_id CHAR(36) NOT NULL,
  estudiante_id CHAR(36) NOT NULL,
  leido_apoderado BOOLEAN DEFAULT FALSE,
  leido_apoderado_at DATETIME NULL,
  correo_enviado BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (comunicado_id) REFERENCES comunicados(id) ON DELETE CASCADE,
  FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id)
);

CREATE TABLE comunicado_respuestas (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  destinatario_id CHAR(36) NOT NULL,
  mensaje TEXT NOT NULL,
  adjunto_nombre VARCHAR(200) NULL,
  adjunto_drive_url TEXT NULL,
  leido_auxiliar BOOLEAN DEFAULT FALSE,
  leido_auxiliar_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (destinatario_id) REFERENCES comunicado_destinatarios(id)
);

CREATE TABLE reportes_semanales (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  estudiante_id CHAR(36) NOT NULL,
  semana_inicio DATE NOT NULL,
  semana_fin DATE NOT NULL,
  dias_asistio INT DEFAULT 0,
  dias_laborables INT DEFAULT 0,
  tardanzas INT DEFAULT 0,
  faltas INT DEFAULT 0,
  comunicados_pendientes INT DEFAULT 0,
  correo_enviado BOOLEAN DEFAULT FALSE,
  correo_enviado_at DATETIME NULL,
  FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id)
);

CREATE TABLE dispositivos_usuario (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  usuario_id CHAR(36) NOT NULL,
  fcm_token VARCHAR(500) NOT NULL UNIQUE,
  plataforma VARCHAR(20) NULL,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_usuario (usuario_id),
  INDEX idx_activo (activo)
);

-- Usuario admin por defecto  (password: Admin2025!)
INSERT INTO usuarios (id, dni, nombre, apellido, email, password_hash, rol, nivel, activo) VALUES
(UUID(), '00000000', 'Admin', 'CEAUNE', 'admin@ceaune.edu.pe',
 '$2b$12$nCk34LTc/w5e6rDxMCl0Oexb2hEp2VoDlVHnBGg7tiwwoGFrf/3wm',
 'admin', 'todos', TRUE);
