# Sistema de Asistencia CEAUNE — Fase 1

Sistema de control de asistencia para secundaria con escaneo QR, notificaciones por correo y vistas por rol.

## Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Python 3.11 + FastAPI + SQLAlchemy 2.0
- **Base de datos**: MySQL 8
- **Auth**: JWT (python-jose)
- **Correos**: Gmail API (OAuth2)
- **QR**: `qrcode` (Python) + `jsQR` + `react-webcam` (navegador)
- **Contenedor**: Docker + docker-compose

## Levantar en desarrollo

```bash
# 1. Copiar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# 2. Levantar todo
docker-compose up -d

# 3. Acceder
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
# Docs API: http://localhost:8000/docs
```

## Roles de usuario

| Rol | Acceso |
|-----|--------|
| `admin` | Dashboard completo, gestión de estudiantes |
| `auxiliar` | Escanear QR, ver registros del día |
| `apoderado` | Ver asistencias de su(s) hijo(s) |

## Usuarios de prueba

| DNI | Contraseña | Rol |
|-----|-----------|-----|
| 00000001 | admin123 | admin |
| 00000002 | auxiliar123 | auxiliar |
| 00000003 | apoderado123 | apoderado |

## Horario secundaria

- **Ingreso puntual**: hasta las 07:45
- **Tardanza**: ingreso después de las 07:45
- **Registro automático de faltas**: 15:00 (APScheduler)
- **Hora de salida**: desde las 15:15
