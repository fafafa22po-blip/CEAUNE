#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════╗
║        CEAUNE — Generador de Token Google OAuth2             ║
╚══════════════════════════════════════════════════════════════╝

Obtiene un nuevo Refresh Token que autoriza AMBOS servicios Google:
  · gmail.send   → notificaciones automáticas a apoderados
  · drive.file   → adjuntos de horarios, justificaciones, comunicados

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CÓMO USAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Opción A — Desde el host (recomendado, abre el navegador solo):
  ┌──────────────────────────────────────────────────────────┐
  │  cd C:\\proyectos\\ceaune                                  │
  │  pip install google-auth-oauthlib google-api-python-client python-dotenv
  │  python backend/scripts/generar_token_google.py           │
  └──────────────────────────────────────────────────────────┘

  Opción B — Desde Docker (con port mapping temporal):
  ┌──────────────────────────────────────────────────────────┐
  │  1. Agregar en docker-compose.yml bajo el servicio        │
  │     backend: ports: ["8080:8080"]                         │
  │  2. docker compose up -d backend                          │
  │  3. docker exec -it ceaune_backend \\                      │
  │       python /app/scripts/generar_token_google.py         │
  │  4. Quitar el puerto y reiniciar: docker compose up -d    │
  └──────────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESULTADO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  · Actualiza GMAIL_REFRESH_TOKEN en el .env del proyecto
  · Verifica Gmail + Drive antes de guardar
  · Muestra el comando para reiniciar el backend
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path


# ─── Colores ANSI (auto-desactivan en Windows sin soporte) ───────────────────

class C:
    RESET  = "\033[0m"
    BOLD   = "\033[1m"
    GREEN  = "\033[92m"
    RED    = "\033[91m"
    YELLOW = "\033[93m"
    CYAN   = "\033[96m"
    DIM    = "\033[2m"

    @staticmethod
    def enable() -> bool:
        if sys.platform == "win32":
            import ctypes
            kernel = ctypes.windll.kernel32  # type: ignore[attr-defined]
            kernel.SetConsoleMode(kernel.GetStdHandle(-11), 7)
        return True


C.enable()


# ─── Rutas ────────────────────────────────────────────────────────────────────

SCRIPT_DIR  = Path(__file__).resolve().parent          # backend/scripts/
BACKEND_DIR = SCRIPT_DIR.parent                        # backend/
PROJECT_DIR = BACKEND_DIR.parent                       # ceaune/

# El .env puede estar en la raíz del proyecto o en backend/
_candidate_envs = [PROJECT_DIR / ".env", BACKEND_DIR / ".env"]
ENV_FILE = next((p for p in _candidate_envs if p.exists()), PROJECT_DIR / ".env")

SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/drive.file",
]

LINE = "─" * 62
DLINE = "═" * 62


# ─── Helpers visuales ─────────────────────────────────────────────────────────

def ok(msg: str) -> None:
    print(f"  {C.GREEN}✓{C.RESET}  {msg}")

def fail(msg: str) -> None:
    print(f"  {C.RED}✗{C.RESET}  {msg}")

def warn(msg: str) -> None:
    print(f"  {C.YELLOW}⚠{C.RESET}  {msg}")

def info(msg: str) -> None:
    print(f"  {C.CYAN}→{C.RESET}  {msg}")

def header(title: str) -> None:
    print(f"\n{C.BOLD}{DLINE}{C.RESET}")
    print(f"  {C.BOLD}{title}{C.RESET}")
    print(f"{C.BOLD}{DLINE}{C.RESET}")

def section(title: str) -> None:
    print(f"\n{LINE}")
    print(f"  {C.CYAN}{C.BOLD}{title}{C.RESET}")
    print(LINE)


# ─── Importar dependencias con guía de instalación ───────────────────────────

def _import_deps():
    missing = []
    try:
        from dotenv import load_dotenv  # noqa: F401
    except ImportError:
        missing.append("python-dotenv")

    try:
        from google_auth_oauthlib.flow import InstalledAppFlow  # noqa: F401
    except ImportError:
        missing.append("google-auth-oauthlib")

    try:
        from google.oauth2.credentials import Credentials          # noqa: F401
        from google.auth.transport.requests import Request         # noqa: F401
        from googleapiclient.discovery import build                # noqa: F401
    except ImportError:
        missing.append("google-api-python-client")

    if missing:
        fail("Faltan dependencias. Instálalas con:")
        print(f"\n    pip install {' '.join(missing)}\n")
        sys.exit(1)


# ─── Cargar credenciales desde .env ──────────────────────────────────────────

def load_credentials() -> tuple[str, str]:
    from dotenv import load_dotenv

    if not ENV_FILE.exists():
        fail(f"Archivo .env no encontrado en: {ENV_FILE}")
        info("Asegúrate de ejecutar el script desde la raíz del proyecto.")
        sys.exit(1)

    load_dotenv(ENV_FILE)
    client_id     = os.getenv("GMAIL_CLIENT_ID", "").strip()
    client_secret = os.getenv("GMAIL_CLIENT_SECRET", "").strip()

    if not client_id or not client_secret:
        fail("GMAIL_CLIENT_ID o GMAIL_CLIENT_SECRET no encontrados en .env")
        info(f"Archivo revisado: {ENV_FILE}")
        sys.exit(1)

    return client_id, client_secret


# ─── Construir config OAuth2 (cliente instalado) ─────────────────────────────

def _client_config(client_id: str, client_secret: str) -> dict:
    return {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uris": ["http://localhost:8080/", "urn:ietf:wg:oauth:2.0:oob"],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }


# ─── Flujo OAuth2 ─────────────────────────────────────────────────────────────

def _is_in_docker() -> bool:
    return Path("/.dockerenv").exists()


def authorize(client_id: str, client_secret: str) -> str:
    from google_auth_oauthlib.flow import InstalledAppFlow

    config = _client_config(client_id, client_secret)

    if _is_in_docker():
        return _authorize_docker(config)

    flow = InstalledAppFlow.from_client_config(config, scopes=SCOPES)
    return _authorize_local(flow)


def _authorize_local(flow) -> str:
    """Abre el navegador automáticamente y recibe el código por redirect."""
    info("Abriendo navegador para autorizar...")
    info(f"Cuenta recomendada: {C.BOLD}asistencia.ceaune@gmail.com{C.RESET}")
    print()

    oauth_kwargs = dict(
        prompt="consent",
        access_type="offline",
        success_message=(
            "✓ Autorización completada — "
            "puedes cerrar esta pestaña y volver a la terminal."
        ),
    )

    try:
        creds = flow.run_local_server(port=8080, **oauth_kwargs)
    except OSError:
        # Puerto 8080 ocupado → usar puerto libre
        warn("Puerto 8080 ocupado, usando puerto aleatorio...")
        creds = flow.run_local_server(port=0, **oauth_kwargs)

    if not creds.refresh_token:
        fail("No se obtuvo refresh_token.")
        info("Asegúrate de autorizar con 'consent' (no reutilizar sesión).")
        sys.exit(1)

    return creds.refresh_token


def _authorize_docker(config: dict) -> str:
    """Modo manual para entornos sin navegador (Docker, SSH)."""
    from google_auth_oauthlib.flow import Flow as _Flow

    manual_flow = _Flow.from_client_config(
        config,
        scopes=SCOPES,
        redirect_uri="http://localhost:8080/",
    )
    auth_url, _ = manual_flow.authorization_url(
        prompt="consent",
        access_type="offline",
    )

    print(f"\n  {C.YELLOW}Modo Docker detectado — autorización manual{C.RESET}")
    print(f"\n  {C.BOLD}1. Abre esta URL en tu navegador:{C.RESET}\n")
    print(f"     {C.CYAN}{auth_url}{C.RESET}\n")
    print(f"  {C.BOLD}2. Autoriza con:{C.RESET} asistencia.ceaune@gmail.com")
    print(f"  {C.BOLD}3. Copia la URL completa a la que redirige (aunque dé error):{C.RESET}")
    print(f"     Ejemplo: http://localhost:8080/?code=4/0A...&scope=...\n")

    redirect_url = input("  Pega la URL de redirección aquí: ").strip()
    if not redirect_url:
        fail("URL vacía. Proceso cancelado.")
        sys.exit(1)

    try:
        manual_flow.fetch_token(authorization_response=redirect_url)
    except Exception as exc:
        fail(f"Error al obtener token: {exc}")
        sys.exit(1)

    token = manual_flow.credentials.refresh_token
    if not token:
        fail("No se obtuvo refresh_token en la respuesta.")
        sys.exit(1)

    return token


# ─── Verificación de servicios ────────────────────────────────────────────────

def _make_creds(client_id: str, client_secret: str, refresh_token: str):
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request

    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
        scopes=SCOPES,
    )
    creds.refresh(Request())
    return creds


def verify_gmail(client_id: str, client_secret: str, refresh_token: str) -> bool:
    """
    Verifica que el token tenga el scope gmail.send usando tokeninfo.
    No llama a getProfile (requiere gmail.readonly, que no tenemos).
    """
    import json
    import urllib.error
    import urllib.request

    try:
        creds = _make_creds(client_id, client_secret, refresh_token)

        url = f"https://oauth2.googleapis.com/tokeninfo?access_token={creds.token}"
        with urllib.request.urlopen(url) as resp:
            data = json.loads(resp.read().decode())

        granted = set(data.get("scope", "").split())
        email   = data.get("email", "desconocido")

        if "https://www.googleapis.com/auth/gmail.send" in granted:
            ok(f"Gmail conectado  →  {C.BOLD}{email}{C.RESET}  (scope gmail.send autorizado)")
            return True
        else:
            fail(f"Gmail: scope gmail.send NO está en el token")
            info(f"Scopes concedidos: {', '.join(sorted(granted))}")
            return False

    except urllib.error.HTTPError as exc:
        fail(f"Gmail tokeninfo falló ({exc.code}): {exc.read().decode()}")
        return False
    except Exception as exc:
        fail(f"Gmail falló: {exc}")
        return False


def verify_drive(client_id: str, client_secret: str, refresh_token: str) -> bool:
    from googleapiclient.discovery import build

    try:
        creds   = _make_creds(client_id, client_secret, refresh_token)
        service = build("drive", "v3", credentials=creds, cache_discovery=False)
        # Sólo verifica que el scope funcione — no accede a archivos existentes
        service.files().list(pageSize=1, fields="files(id)").execute()
        ok(f"Drive conectado  →  scope {C.BOLD}drive.file{C.RESET} autorizado")
        return True
    except Exception as exc:
        fail(f"Drive falló: {exc}")
        return False


# ─── Actualizar .env ──────────────────────────────────────────────────────────

def update_env(refresh_token: str) -> None:
    content = ENV_FILE.read_text(encoding="utf-8")

    if re.search(r"^GMAIL_REFRESH_TOKEN\s*=", content, flags=re.MULTILINE):
        new_content = re.sub(
            r"^(GMAIL_REFRESH_TOKEN\s*=).*$",
            rf"\g<1>{refresh_token}",
            content,
            flags=re.MULTILINE,
        )
    else:
        # La variable no existe en el .env → agregarla al final
        new_content = content.rstrip("\n") + f"\nGMAIL_REFRESH_TOKEN={refresh_token}\n"

    ENV_FILE.write_text(new_content, encoding="utf-8")
    ok(f".env actualizado  →  {C.DIM}{ENV_FILE}{C.RESET}")


# ─── Punto de entrada ─────────────────────────────────────────────────────────

def main() -> None:
    header("CEAUNE — Generador de Token Google OAuth2")

    print(f"\n  Scopes solicitados:")
    print(f"    {C.DIM}· https://www.googleapis.com/auth/gmail.send{C.RESET}")
    print(f"    {C.DIM}· https://www.googleapis.com/auth/drive.file{C.RESET}")
    print(f"\n  Archivo .env: {C.DIM}{ENV_FILE}{C.RESET}")

    # ── 0. Verificar dependencias ─────────────────────────────────────────────
    section("Paso 1 — Verificando dependencias")
    _import_deps()
    ok("Todas las dependencias disponibles")

    # ── 1. Cargar credenciales ────────────────────────────────────────────────
    section("Paso 2 — Cargando credenciales del .env")
    client_id, client_secret = load_credentials()
    ok(f"Client ID  →  {C.DIM}{client_id[:45]}...{C.RESET}")

    # ── 2. Flujo OAuth2 ───────────────────────────────────────────────────────
    section("Paso 3 — Autorización OAuth2 con Google")
    refresh_token = authorize(client_id, client_secret)
    ok("Refresh Token obtenido correctamente")

    # ── 3. Verificar Gmail + Drive ────────────────────────────────────────────
    section("Paso 4 — Verificando acceso a Google APIs")
    gmail_ok = verify_gmail(client_id, client_secret, refresh_token)
    drive_ok = verify_drive(client_id, client_secret, refresh_token)

    if not gmail_ok or not drive_ok:
        warn("Una o más verificaciones fallaron.")
        print(f"\n  {C.YELLOW}Token obtenido (guárdalo manualmente si es necesario):{C.RESET}")
        print(f"  GMAIL_REFRESH_TOKEN={refresh_token}\n")
        sys.exit(1)

    # ── 4. Actualizar .env ────────────────────────────────────────────────────
    section("Paso 5 — Actualizando .env")
    update_env(refresh_token)

    # ── 5. Resumen final ──────────────────────────────────────────────────────
    header("PROCESO COMPLETADO")

    print(f"\n  {C.GREEN}{C.BOLD}Gmail ✓  |  Drive ✓  |  .env actualizado ✓{C.RESET}\n")

    print(f"  {C.BOLD}Reinicia el backend para aplicar los cambios:{C.RESET}\n")
    print(f"    {C.CYAN}docker compose restart backend{C.RESET}\n")

    print(f"  {C.BOLD}Funcionalidades habilitadas:{C.RESET}")
    print(f"    · Admin     → subir archivos (horarios)")
    print(f"    · Apoderado → justificar ausencias con adjunto")
    print(f"    · Auxiliar  → enviar comunicados con adjunto")
    print(f"    · Sistema   → correos automáticos a apoderados\n")
    print(f"{DLINE}\n")


if __name__ == "__main__":
    main()
