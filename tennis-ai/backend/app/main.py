from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from app.admin.setup import setup_admin
from app.admin.panel_router import router as panel_router
from app.api.v1.router import api_router
from app.database import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()


app = FastAPI(
    title="Tennis AI - Sparring Partner Search",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(panel_router)

# Admin panel (sqladmin)
setup_admin(app, engine)


@app.get("/payment-success", response_class=HTMLResponse)
async def payment_success(request: Request):
    """Страница после успешной оплаты ЮКасса."""
    return HTMLResponse(content="""
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Оплата прошла успешно</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #1a1a2e;
      color: #fff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #16213e;
      border-radius: 20px;
      padding: 48px 40px;
      text-align: center;
      max-width: 400px;
      width: 90%;
      border: 1px solid #F5A623;
    }
    .crown { font-size: 64px; margin-bottom: 16px; }
    h1 { font-size: 24px; font-weight: 800; color: #F5A623; margin-bottom: 12px; }
    p { color: #aaa; font-size: 15px; line-height: 1.6; margin-bottom: 24px; }
    .hint {
      background: #0f1b33;
      border-radius: 12px;
      padding: 14px;
      font-size: 13px;
      color: #888;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="crown">👑</div>
    <h1>Premium активирован!</h1>
    <p>Оплата прошла успешно.<br>Вернитесь в приложение TennisAI.</p>
    <div class="hint">Можно закрыть эту вкладку</div>
  </div>
</body>
</html>
""", status_code=200)
