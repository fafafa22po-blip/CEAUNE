from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "mysql+pymysql://ceaune_user:ceaune_pass_2025@mysql:3306/ceaune_asistencia"
    SECRET_KEY: str = "changeme"
    JWT_EXPIRE_HOURS: int = 720  # 30 días
    GMAIL_CLIENT_ID: str = ""
    GMAIL_CLIENT_SECRET: str = ""
    GMAIL_REFRESH_TOKEN: str = ""
    GMAIL_FROM: str = "asistencia@ceaune.edu.pe"
    DRIVE_FOLDER_ID: str = ""
    FRONTEND_URL: str = "http://localhost:5173"
    ENVIRONMENT: str = "development"
    FIREBASE_CREDENTIALS_PATH: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
