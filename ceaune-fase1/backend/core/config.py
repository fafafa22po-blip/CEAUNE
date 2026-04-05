from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "mysql+pymysql://ceaune_user:ceaune_pass_2025@localhost:3306/ceaune_fase1"
    SECRET_KEY: str = "changeme"
    JWT_EXPIRE_HOURS: int = 8
    GMAIL_CLIENT_ID: str = ""
    GMAIL_CLIENT_SECRET: str = ""
    GMAIL_REFRESH_TOKEN: str = ""
    GMAIL_FROM: str = "asistencia@ceaune.edu.pe"
    FRONTEND_URL: str = "http://localhost:5173"
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
