"""
Centralized configuration.

CRITICAL SECURITY RULE: no secrets are ever hardcoded here. Everything is
read from environment variables (via a local .env file in development, or
real environment variables / a secrets manager in production).

Copy `.env.example` to `.env` and fill in real values before running.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    app_env: str = "development"
    app_secret_key: str = "insecure-dev-key-change-me"
    cors_origins: str = "http://localhost:5500"

    # Database
    database_url: str = "sqlite:///./data/mysoul.db"

    # OpenRouter (PRIMARY LLM)
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "anthropic/claude-3.5-sonnet"
    openrouter_timeout_seconds: int = 20
    openrouter_max_retries: int = 2
    openrouter_site_url: str = ""
    openrouter_app_name: str = "MySoul AI"

    # Ollama (FALLBACK LLM)
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1:8b"
    ollama_timeout_seconds: int = 30

    # Circuit breaker
    circuit_breaker_failure_threshold: int = 3
    circuit_breaker_reset_seconds: int = 60

    # Emotion model
    emotion_model_name: str = "SamLowe/roberta-base-go_emotions"
    emotion_device: str = "cpu"

    # Embeddings / memory
    embedding_model_name: str = "sentence-transformers/all-MiniLM-L6-v2"
    faiss_index_path: str = "./data/faiss_index"
    memory_top_k: int = 5

    # Voice
    whisper_model_size: str = "small"
    whisper_device: str = "cpu"
    edge_tts_voice: str = "en-US-JennyNeural"
    tts_output_dir: str = "./data/tts_cache"

    # Alerts
    alert_provider: str = "console"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""

    # Rate limiting
    rate_limit_per_minute: int = 60

    # Auth
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7

    # Proactive companion engine
    followup_scheduler_interval_seconds: int = 300
    followup_silence_gap_hours: int = 30
    followup_mood_dip_intensity_threshold: float = 0.7

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
