"""FastAPI app cho Lie Trainer. Chạy: uvicorn backend.api.main:app --reload

Kiến trúc: tách frontend/backend qua REST API. Mỗi tính năng có 1 router
riêng trong backend/api/ — file này CHỈ import và gộp lại, KHÔNG viết logic
ở đây (đúng contract-first như dự án mẫu LAWGIC).

Serve luôn frontend tĩnh ở "/" nếu thư mục frontend/static tồn tại — frontend
mới (React/Vue/HTML thuần) sẽ build ra thư mục đó. Trong lúc frontend chưa
có, comment dòng mount ở cuối file lại để tránh lỗi thư mục không tồn tại.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.api import arena_endpoint, knowledge_endpoint, vision_endpoint, voice_endpoint

ROOT = Path(__file__).resolve().parents[2]
STATIC_DIR = ROOT / "frontend" / "static"

app = FastAPI(title="Lie Trainer API", version="0.1.0")

# Demo local — production thật thì khoá lại theo đúng domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(vision_endpoint.router)
app.include_router(arena_endpoint.router)
app.include_router(knowledge_endpoint.router)
app.include_router(voice_endpoint.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


# Mount frontend tĩnh CUỐI CÙNG để không nuốt mất các route /api/* ở trên
if STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")