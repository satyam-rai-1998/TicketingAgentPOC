from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    port: int = 8000
    database_url: str = "sqlite:///./ticketing.db"
    api_token: str = "changeme-local-dev-token"
    webhook_target_url: str | None = None
    webhook_auth_token: str | None = None


settings = Settings()
