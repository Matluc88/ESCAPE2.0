from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "postgresql://user:pass@db:5432/escape"
    mqtt_host: str = "mqtt"
    mqtt_port: int = 1883
    ws_port: int = 3000
    api_host: str = "0.0.0.0"
    jwt_secret: str = "your-secret-key-change-in-production"
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
