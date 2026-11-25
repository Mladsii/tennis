from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://tennis:tennis@localhost:5432/tennis_ai"
    JWT_SECRET_KEY: str = "change-me-to-random-secret-key"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    S3_ENDPOINT_URL: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_BUCKET_NAME: str = "tennis-ai-photos"

    # ЮКасса (тестовый магазин)
    YOOKASSA_SHOP_ID: str = "100500"
    YOOKASSA_SECRET_KEY: str = "test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    YOOKASSA_RETURN_URL: str = "https://tennisai.app/payment-success"
    PREMIUM_PRICE_RUB: str = "199.00"
    PREMIUM_MONTHS: int = 1

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
