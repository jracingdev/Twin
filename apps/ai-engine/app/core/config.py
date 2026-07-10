from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    redis_url: str = "redis://localhost:6379/0"
    pinecone_api_key: str = ""
    pinecone_index: str = "twin-integrated"
    pinecone_index_host: str = ""
    openai_api_key: str = ""
    llm_provider: str = "openai"
    ai_engine_secret: str = "change-me-internal-secret"
    laravel_api_url: str = "http://127.0.0.1:8080"
    embed_model: str = "multilingual-e5-large"
    celery_ingest: bool = False
    # Comma-separated origins; empty = no browser CORS (API-to-API only).
    cors_origins: str = ""


settings = Settings()
