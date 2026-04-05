# Sistema de Asistencia CEAUNE

Sistema de control de asistencia escolar con registro QR, notificaciones por correo y panel web.

## Stack
- **Frontend:** React 18 + Vite + Tailwind CSS
- **Backend:** Python 3.11 + FastAPI + SQLAlchemy 2.0
- **BD:** MySQL 8
- **Auth:** JWT (8 horas)
- **Correos:** Gmail API (Google Workspace)
- **Archivos:** Google Drive API

## Requisitos
- Docker + Docker Compose
- Node.js 18+ (desarrollo local frontend)
- Python 3.11+ (desarrollo local backend)

## Inicio rápido

```bash
# 1. Clonar y configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# 2. Levantar todos los servicios
docker compose up -d

# 3. Verificar que todo esté corriendo
docker compose ps
```

## Servicios

| Servicio  | URL                        |
|-----------|----------------------------|
| Frontend  | http://localhost:5173       |
| Backend   | http://localhost:8000       |
| API Docs  | http://localhost:8000/docs  |
| MySQL     | localhost:3306              |

## Roles de usuario

| Rol          | Acceso                                              |
|--------------|-----------------------------------------------------|
| `admin`      | Todo el sistema                                     |
| `i-auxiliar` | Escaneo y comunicados — nivel Inicial               |
| `p-auxiliar` | Escaneo y comunicados — nivel Primaria              |
| `s-auxiliar` | Escaneo y comunicados — nivel Secundaria            |
| `tutor`      | Vista de su aula + observaciones                    |
| `apoderado`  | Asistencias de sus hijos + comunicados + justificar |

## Desarrollo local (sin Docker)

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

## Colores corporativos
- Azul marino: `#0a1f3d`
- Dorado: `#c9a227`
- Verde petróleo: `#1a5c52`
