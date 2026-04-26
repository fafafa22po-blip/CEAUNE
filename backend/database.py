from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=280,       # Railway MySQL mata conexiones idle ~5min; reciclar antes
    pool_size=3,
    max_overflow=5,
    pool_timeout=10,        # esperar máx 10s por una conexión libre del pool
    connect_args={
        "connect_timeout": 8,   # si MySQL no responde en 8s → error Python inmediato
        "read_timeout":    20,  # query ejecutándose > 20s → error Python inmediato
        "write_timeout":   20,
    },
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
