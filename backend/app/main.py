import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.config import settings
from app.database import init_db
from app.routers import generate, websocket, gallery, models
from app.services.comfy_client import comfy_client

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing database...")
    init_db()
    
    logger.info("Starting ComfyUI WebSocket background listener...")
    ws_task = asyncio.create_task(comfy_client.start_ws_listener())
    
    yield
    
    # Shutdown
    logger.info("Shutting down background tasks...")
    comfy_client._is_running = False
    ws_task.cancel()
    try:
        await ws_task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

# CORS configuration for modern local SPA
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(generate.router)
app.include_router(websocket.router)
app.include_router(gallery.router)
app.include_router(models.router)

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "offline_mode": True,
        "version": settings.VERSION
    }

# Mount static outputs folder
app.mount("/outputs", StaticFiles(directory=str(settings.OUTPUTS_DIR)), name="outputs")

# Mount frontend production build if exists (MUST be last to avoid masking API routes)
frontend_dist = settings.BASE_DIR / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")

