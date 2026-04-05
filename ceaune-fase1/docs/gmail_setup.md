# Configurar Gmail API para CEAUNE

## Qué necesitas

Tres valores para el `.env`:
```
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
```

---

## Paso 1 — Crear proyecto en Google Cloud

1. Ve a https://console.cloud.google.com/
2. Crea un proyecto nuevo (ej. `ceaune-asistencia`)
3. En el menú lateral: **APIs y servicios → Biblioteca**
4. Busca **Gmail API** → Habilitar
5. Busca **Google Drive API** → Habilitar

---

## Paso 2 — Crear credenciales OAuth2

1. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente OAuth**
2. Tipo de aplicación: **Aplicación de escritorio**
3. Nombre: `CEAUNE Asistencia`
4. Descarga el JSON → guárdalo como `credentials.json` (NO commitear)
5. De ese JSON, copia:
   - `client_id` → `GMAIL_CLIENT_ID`
   - `client_secret` → `GMAIL_CLIENT_SECRET`

---

## Paso 3 — Obtener el Refresh Token (una sola vez)

Ejecuta este script en tu máquina (necesita Python + google-auth-oauthlib):

```bash
pip install google-auth-oauthlib
```

Usa el script `get_token.py` que está en la raíz del proyecto:

```bash
# Instalar dependencia si no la tienes
pip install google-auth-oauthlib

# Coloca credentials.json en la raíz del proyecto y ejecuta:
python get_token.py
```

- Se abrirá el navegador
- Inicia sesión con la cuenta `asistencia.ceaune@gmail.com`
- Autoriza los permisos de **Gmail (enviar correos)** y **Drive (subir archivos)**
- Copia el `REFRESH_TOKEN` impreso → `GMAIL_REFRESH_TOKEN` en `.env`

> **Importante:** el token incluye ambos scopes: `gmail.send` y `drive.file`.
> Necesario para enviar correos Y subir PDFs/imágenes de horarios, comunicados y justificaciones.

---

## Paso 4 — Agregar al .env

```env
GMAIL_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxx
GMAIL_REFRESH_TOKEN=1//0xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GMAIL_FROM=asistencia@ceaune.edu.pe
```

Reinicia el backend:
```bash
docker-compose restart backend
```

---

## Verificar que funciona

```bash
# Registra un ingreso de prueba y revisa los logs
docker logs ceaune_backend | grep Gmail
```

Deberías ver:
```
[Gmail] Correo enviado a apoderado@gmail.com — ✅ Carlos llegó al colegio — 07:30
```

---

## Notas

- El refresh token no expira (mientras la cuenta no revoque el acceso)
- Solo necesitas hacer el Paso 3 una vez por cuenta
- En producción (cPanel), los mismos valores van en las variables de entorno del servidor
- Si la cuenta es Google Workspace (no Gmail personal), puede necesitar que el admin
  habilite "Acceso de aplicaciones menos seguras" o configure el proyecto como interno
