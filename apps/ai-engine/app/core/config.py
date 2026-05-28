from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    redis_url: str = "redis://localhost:6379/0"
    pinecone_api_key: str = ""
    pinecone_index: str = "twin-integrated"
    openai_api_key: str = ""
    ai_engine_secret: str = "change-me-internal-secret"
    laravel_api_url: str = "http://127.0.0.1:8080"
    embed_model: str = "multilingual-e5-large"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
