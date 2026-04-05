"""
Script para generar el GMAIL_REFRESH_TOKEN con permisos de Gmail + Drive.
Ejecutar UNA sola vez desde el PC (necesita navegador).

Requisitos:
    pip install google-auth-oauthlib

Uso:
    1. Descarga credentials.json desde Google Cloud Console (OAuth2 Escritorio)
       y colócalo en la misma carpeta que este script.
    2. python get_token.py
    3. Autoriza en el navegador con la cuenta asistencia.ceaune@gmail.com
    4. Copia el REFRESH_TOKEN impreso → GMAIL_REFRESH_TOKEN en .env
    5. Reinicia el backend: docker-compose restart backend
"""

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/drive.file",
]

flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
creds = flow.run_local_server(port=0, prompt="consent", access_type="offline")

print("\n" + "=" * 60)
print("REFRESH_TOKEN:", creds.refresh_token)
print("=" * 60)
print("\nCopia este valor en tu .env como GMAIL_REFRESH_TOKEN=...")
print("Luego reinicia el backend: docker-compose restart backend\n")
