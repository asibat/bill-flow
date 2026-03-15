from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ocr_languages: list[str] = ["en", "fr", "nl"]
    pdf_confidence: float = 95.0
    max_file_size_mb: int = 20

    model_config = {"env_prefix": "PII_"}


settings = Settings()
